import crypto from "crypto";
import { and, desc, eq, count, gte, inArray, lte } from "drizzle-orm";
import { db } from "../db/index.ts";
import {
  cart,
  cartItem,
  cake,
  cakeVariant,
  cakeImage,
  address,
  order,
  orderItem,
  orderStatusHistory,
} from "../db/schema/app-schema.ts";
import { razorpay, generateOrderNumber } from "../lib/razorpay.ts";
import { newId } from "../lib/id.ts";
import { clearCart } from "./cart.service.ts";
import { parsePagination, paginate } from "../lib/pagination.ts";

// ─── Constants ────────────────────────────────────────────────────────────────

const FREE_DELIVERY_ABOVE = 500;   // ₹500+ orders get free delivery
const DELIVERY_FEE = 50;           // ₹50 delivery fee otherwise

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlaceOrderInput {
  shippingAddressId: string;
  paymentMethod: "cod" | "upi" | "card" | "netbanking" | "wallet";
  deliveryDate?: string;        // ISO date string
  deliveryTimeSlot?: string;    // e.g. "10:00-12:00"
  customerNote?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build full order detail (order + items + status history + address snapshot). */
async function getOrderFull(orderId: string) {
  const [orderRow] = await db
    .select()
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  if (!orderRow) return null;

  const [items, history] = await Promise.all([
    db.select().from(orderItem).where(eq(orderItem.orderId, orderId)),
    db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, orderId))
      .orderBy(desc(orderStatusHistory.createdAt)),
  ]);

  return { ...orderRow, items, statusHistory: history };
}

// ─── Place Order ──────────────────────────────────────────────────────────────

export async function placeOrder(userId: string, input: PlaceOrderInput) {
  // 1. Load cart items
  const [cartRow] = await db
    .select()
    .from(cart)
    .where(eq(cart.userId, userId))
    .limit(1);

  if (!cartRow) {
    throw Object.assign(new Error("Cart is empty"), { statusCode: 400 });
  }

  const cartItems = await db
    .select({
      id: cartItem.id,
      cakeId: cartItem.cakeId,
      variantId: cartItem.variantId,
      quantity: cartItem.quantity,
      unitPrice: cartItem.unitPrice,
      customMessage: cartItem.customMessage,
      deliveryDate: cartItem.deliveryDate,
    })
    .from(cartItem)
    .where(eq(cartItem.cartId, cartRow.id));

  if (cartItems.length === 0) {
    throw Object.assign(new Error("Cart is empty"), { statusCode: 400 });
  }

  // 2. Validate shipping address belongs to this user
  const [shippingAddr] = await db
    .select()
    .from(address)
    .where(
      and(
        eq(address.id, input.shippingAddressId),
        eq(address.userId, userId),
      ),
    )
    .limit(1);

  if (!shippingAddr) {
    throw Object.assign(new Error("Shipping address not found"), {
      statusCode: 404,
    });
  }

  // 3. Validate cakes and fetch snapshots (name, image, variant)
  const cakeIds = [...new Set(cartItems.map((i) => i.cakeId))];
  const variantIds = cartItems
    .filter((i) => i.variantId)
    .map((i) => i.variantId!);

  const [cakeRows, variantRows, primaryImages] = await Promise.all([
    db.select().from(cake).where(inArray(cake.id, cakeIds)),
    variantIds.length > 0
      ? db.select().from(cakeVariant).where(inArray(cakeVariant.id, variantIds))
      : Promise.resolve([]),
    db
      .select({ cakeId: cakeImage.cakeId, url: cakeImage.url })
      .from(cakeImage)
      .where(and(inArray(cakeImage.cakeId, cakeIds), eq(cakeImage.isPrimary, true))),
  ]);

  const cakeMap = new Map(cakeRows.map((c) => [c.id, c]));
  const variantMap = new Map(variantRows.map((v) => [v.id, v]));
  const imageMap = new Map(primaryImages.map((img) => [img.cakeId, img.url]));

  // Check all cakes are active
  for (const item of cartItems) {
    const c = cakeMap.get(item.cakeId);
    if (!c || !c.isActive) {
      throw Object.assign(
        new Error(`Cake is no longer available`),
        { statusCode: 400 },
      );
    }
  }

  // 4. Check and decrement stock for variant items
  for (const item of cartItems) {
    if (!item.variantId) continue;
    const variant = variantMap.get(item.variantId);
    if (!variant) {
      throw Object.assign(new Error("A variant is no longer available"), {
        statusCode: 400,
      });
    }
    if (variant.stockQty < item.quantity) {
      throw Object.assign(
        new Error(
          `Insufficient stock for "${cakeMap.get(item.cakeId)?.name}" (${variant.name}). Available: ${variant.stockQty}`,
        ),
        { statusCode: 400 },
      );
    }
  }

  // Decrement stock
  for (const item of cartItems) {
    if (!item.variantId) continue;
    await db
      .update(cakeVariant)
      .set({
        stockQty: (variantMap.get(item.variantId)!.stockQty - item.quantity),
      })
      .where(eq(cakeVariant.id, item.variantId));
  }

  // 5. Calculate totals
  const subtotal = cartItems.reduce(
    (sum, item) => sum + parseFloat(item.unitPrice) * item.quantity,
    0,
  );
  const deliveryFee = subtotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_FEE;
  const totalAmount = subtotal + deliveryFee;

  // 6. Create order
  const orderId = newId();
  const orderNumber = generateOrderNumber();

  // Snapshot the shipping address
  const shippingSnapshot = {
    fullName: shippingAddr.fullName,
    phone: shippingAddr.phone,
    line1: shippingAddr.line1,
    line2: shippingAddr.line2,
    city: shippingAddr.city,
    state: shippingAddr.state,
    pincode: shippingAddr.pincode,
    country: shippingAddr.country,
    label: shippingAddr.label,
    addressType: shippingAddr.addressType,
  };

  // COD → immediately confirmed; online → pending until payment verified
  const isCod = input.paymentMethod === "cod";

  await db.insert(order).values({
    id: orderId,
    orderNumber,
    userId,
    status: isCod ? "confirmed" : "pending",
    paymentStatus: "pending",
    paymentMethod: input.paymentMethod,
    shippingAddressId: shippingAddr.id,
    shippingSnapshot,
    subtotal: subtotal.toFixed(2),
    deliveryFee: deliveryFee.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
    deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : undefined,
    deliveryTimeSlot: input.deliveryTimeSlot,
    customerNote: input.customerNote,
  });

  // 7. Create order items (snapshots)
  for (const item of cartItems) {
    const cakeData = cakeMap.get(item.cakeId)!;
    const variantData = item.variantId ? variantMap.get(item.variantId) : null;
    const lineTotal = parseFloat(item.unitPrice) * item.quantity;

    await db.insert(orderItem).values({
      id: newId(),
      orderId,
      cakeId: item.cakeId,
      variantId: item.variantId ?? null,
      cakeName: cakeData.name,
      variantName: variantData?.name ?? null,
      imageUrl: imageMap.get(item.cakeId) ?? null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: lineTotal.toFixed(2),
      customMessage: item.customMessage,
    });
  }

  // 8. First status history entry
  await db.insert(orderStatusHistory).values({
    id: newId(),
    orderId,
    status: isCod ? "confirmed" : "pending",
    note: isCod
      ? "Order placed successfully (Cash on Delivery)"
      : "Order placed, awaiting payment",
    changedBy: userId,
  });

  // 9. Clear the cart
  await clearCart(userId);

  // 10. For online payments — create Razorpay order
  let razorpayData: {
    razorpayOrderId: string;
    amount: number;
    currency: string;
    keyId: string;
  } | null = null;

  if (!isCod) {
    const rpOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100), // paise
      currency: "INR",
      receipt: orderNumber,
      notes: { orderId, userId },
    });

    const razorpayOrderId = rpOrder.id;

    // Store Razorpay order id on the order
    await db
      .update(order)
      .set({ paymentTransactionId: razorpayOrderId })
      .where(eq(order.id, orderId));

    razorpayData = {
      razorpayOrderId,
      amount: Math.round(totalAmount * 100),
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID!,
    };
  }

  const orderFull = await getOrderFull(orderId);
  return { order: orderFull, razorpay: razorpayData };
}

// ─── Payment Verification ─────────────────────────────────────────────────────

export async function verifyPayment(
  orderNumber: string,
  userId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
) {
  // Fetch order and verify ownership
  const [orderRow] = await db
    .select()
    .from(order)
    .where(and(eq(order.orderNumber, orderNumber), eq(order.userId, userId)))
    .limit(1);

  if (!orderRow) {
    throw Object.assign(new Error("Order not found"), { statusCode: 404 });
  }
  if (orderRow.paymentStatus === "paid") {
    throw Object.assign(new Error("Payment already verified"), { statusCode: 409 });
  }

  // Verify Razorpay signature
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    throw Object.assign(new Error("Payment signature verification failed"), {
      statusCode: 400,
    });
  }

  // Update order to paid + confirmed
  await db
    .update(order)
    .set({
      paymentStatus: "paid",
      status: "confirmed",
      paymentTransactionId: razorpayPaymentId,
    })
    .where(eq(order.id, orderRow.id));

  await db.insert(orderStatusHistory).values({
    id: newId(),
    orderId: orderRow.id,
    status: "confirmed",
    note: `Payment confirmed (Razorpay Payment ID: ${razorpayPaymentId})`,
    changedBy: userId,
  });

  return getOrderFull(orderRow.id);
}

// ─── Razorpay Webhook ─────────────────────────────────────────────────────────

export async function handleRazorpayWebhook(
  rawBody: string,
  signature: string,
) {
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");

  if (expectedSignature !== signature) {
    throw Object.assign(new Error("Invalid webhook signature"), {
      statusCode: 400,
    });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "payment.captured") {
    const payment = event.payload.payment.entity;
    const rpOrderId: string = payment.order_id;
    const rpPaymentId: string = payment.id;

    // Find our order by Razorpay order id
    const [orderRow] = await db
      .select()
      .from(order)
      .where(eq(order.paymentTransactionId, rpOrderId))
      .limit(1);

    if (orderRow && orderRow.paymentStatus !== "paid") {
      await db
        .update(order)
        .set({ paymentStatus: "paid", status: "confirmed", paymentTransactionId: rpPaymentId })
        .where(eq(order.id, orderRow.id));

      await db.insert(orderStatusHistory).values({
        id: newId(),
        orderId: orderRow.id,
        status: "confirmed",
        note: `Payment captured via webhook (Payment ID: ${rpPaymentId})`,
      });
    }
  }
}

// ─── Customer: Order History & Detail ────────────────────────────────────────

export async function getMyOrders(
  userId: string,
  query: Record<string, string>,
) {
  const { page, limit, offset } = parsePagination(query);

  const [{ total }] = await db
    .select({ total: count() })
    .from(order)
    .where(eq(order.userId, userId));

  const orders = await db
    .select()
    .from(order)
    .where(eq(order.userId, userId))
    .orderBy(desc(order.createdAt))
    .limit(limit)
    .offset(offset);

  return paginate(orders, total, page, limit);
}

export async function getMyOrderByNumber(
  orderNumber: string,
  userId: string,
) {
  const [orderRow] = await db
    .select()
    .from(order)
    .where(and(eq(order.orderNumber, orderNumber), eq(order.userId, userId)))
    .limit(1);

  if (!orderRow) {
    throw Object.assign(new Error("Order not found"), { statusCode: 404 });
  }

  return getOrderFull(orderRow.id);
}

export async function cancelMyOrder(orderNumber: string, userId: string) {
  const [orderRow] = await db
    .select()
    .from(order)
    .where(and(eq(order.orderNumber, orderNumber), eq(order.userId, userId)))
    .limit(1);

  if (!orderRow) {
    throw Object.assign(new Error("Order not found"), { statusCode: 404 });
  }

  const cancellable = ["pending", "confirmed"];
  if (!cancellable.includes(orderRow.status)) {
    throw Object.assign(
      new Error(`Order cannot be cancelled at status: ${orderRow.status}`),
      { statusCode: 400 },
    );
  }

  await db
    .update(order)
    .set({ status: "cancelled" })
    .where(eq(order.id, orderRow.id));

  await db.insert(orderStatusHistory).values({
    id: newId(),
    orderId: orderRow.id,
    status: "cancelled",
    note: "Cancelled by customer",
    changedBy: userId,
  });

  return getOrderFull(orderRow.id);
}

// ─── Admin: Order Management ──────────────────────────────────────────────────

export async function adminGetOrders(query: Record<string, string>) {
  const { page, limit, offset } = parsePagination(query);

  const conditions = and(
    query.status
      ? eq(order.status, query.status as typeof order.status._.data)
      : undefined,
    query.paymentStatus
      ? eq(order.paymentStatus, query.paymentStatus as typeof order.paymentStatus._.data)
      : undefined,
    query.userId ? eq(order.userId, query.userId) : undefined,
    query.from ? gte(order.createdAt, new Date(query.from)) : undefined,
    query.to ? lte(order.createdAt, new Date(query.to)) : undefined,
  );

  const [{ total }] = await db
    .select({ total: count() })
    .from(order)
    .where(conditions);

  const orders = await db
    .select()
    .from(order)
    .where(conditions)
    .orderBy(desc(order.createdAt))
    .limit(limit)
    .offset(offset);

  return paginate(orders, total, page, limit);
}

export async function adminGetOrderByNumber(orderNumber: string) {
  const [orderRow] = await db
    .select()
    .from(order)
    .where(eq(order.orderNumber, orderNumber))
    .limit(1);

  if (!orderRow) {
    throw Object.assign(new Error("Order not found"), { statusCode: 404 });
  }

  return getOrderFull(orderRow.id);
}

export async function adminUpdateOrderStatus(
  orderNumber: string,
  status: typeof order.status._.data,
  note: string | undefined,
  adminId: string,
) {
  const [orderRow] = await db
    .select()
    .from(order)
    .where(eq(order.orderNumber, orderNumber))
    .limit(1);

  if (!orderRow) {
    throw Object.assign(new Error("Order not found"), { statusCode: 404 });
  }

  await db
    .update(order)
    .set({ status })
    .where(eq(order.id, orderRow.id));

  await db.insert(orderStatusHistory).values({
    id: newId(),
    orderId: orderRow.id,
    status,
    note: note ?? null,
    changedBy: adminId,
  });

  return getOrderFull(orderRow.id);
}

export async function adminUpdateNote(orderNumber: string, adminNote: string) {
  const [orderRow] = await db
    .select({ id: order.id })
    .from(order)
    .where(eq(order.orderNumber, orderNumber))
    .limit(1);

  if (!orderRow) {
    throw Object.assign(new Error("Order not found"), { statusCode: 404 });
  }

  await db
    .update(order)
    .set({ adminNote })
    .where(eq(order.id, orderRow.id));
}
