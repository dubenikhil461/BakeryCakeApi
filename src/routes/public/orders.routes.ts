import { Hono } from "hono";
import { z } from "zod";
import type { HonoVariables } from "../../types/hono.ts";
import { requireAuth } from "../../middleware/auth.middleware.ts";
import { validateBody } from "../../middleware/validate.middleware.ts";
import {
  placeOrder,
  verifyPayment,
  getMyOrders,
  getMyOrderByNumber,
  cancelMyOrder,
} from "../../services/order.service.ts";
import { handleRazorpayWebhook } from "../../services/order.service.ts";

const ordersPublic = new Hono<{ Variables: HonoVariables }>();

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const placeOrderSchema = z.object({
  shippingAddressId: z.string().uuid(),
  paymentMethod: z.enum(["cod", "upi", "card", "netbanking", "wallet"]),
  deliveryDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), "Invalid date format")
    .optional(),
  deliveryTimeSlot: z.string().max(50).optional(),
  customerNote: z.string().max(1000).optional(),
});

const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
});

// ─── POST /api/orders ─────────────────────────────────────────────────────────
// Place an order from the current cart.
// For online payments, returns razorpay { razorpayOrderId, amount, keyId }.
// For COD, order is immediately confirmed and razorpay field is null.

ordersPublic.post("/", requireAuth, validateBody(placeOrderSchema), async (c) => {
  const user = c.get("user")!;
  const input = c.get("validatedBody") as z.infer<typeof placeOrderSchema>;

  try {
    const result = await placeOrder(user.id, input);
    return c.json({ success: true, data: result }, 201);
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to place order" },
      (e.statusCode as 400 | 404 | 500) ?? 500,
    );
  }
});

// ─── GET /api/orders ──────────────────────────────────────────────────────────
// Paginated order history for the logged-in customer.

ordersPublic.get("/", requireAuth, async (c) => {
  const user = c.get("user")!;
  const result = await getMyOrders(user.id, c.req.query());
  return c.json({ success: true, ...result });
});

// ─── GET /api/orders/:orderNumber ────────────────────────────────────────────
// Single order detail (customer can only see their own).

ordersPublic.get("/:orderNumber", requireAuth, async (c) => {
  const user = c.get("user")!;
  const orderNumber = c.req.param("orderNumber");

  try {
    const data = await getMyOrderByNumber(orderNumber, user.id);
    return c.json({ success: true, data });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Order not found" },
      (e.statusCode as 404 | 500) ?? 500,
    );
  }
});

// ─── POST /api/orders/:orderNumber/payment/verify ────────────────────────────
// Called by frontend after Razorpay checkout completes.
// Verifies HMAC-SHA256 signature and marks order as paid.

ordersPublic.post(
  "/:orderNumber/payment/verify",
  requireAuth,
  validateBody(verifyPaymentSchema),
  async (c) => {
    const user = c.get("user")!;
    const orderNumber = c.req.param("orderNumber");
    const input = c.get("validatedBody") as z.infer<typeof verifyPaymentSchema>;

    try {
      const data = await verifyPayment(
        orderNumber,
        user.id,
        input.razorpayOrderId,
        input.razorpayPaymentId,
        input.razorpaySignature,
      );
      return c.json({ success: true, data });
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number };
      return c.json(
        { success: false, error: e.message ?? "Payment verification failed" },
        (e.statusCode as 400 | 404 | 409 | 500) ?? 500,
      );
    }
  },
);

// ─── POST /api/orders/:orderNumber/cancel ────────────────────────────────────
// Customer cancels their own order (only allowed for pending/confirmed status).

ordersPublic.post("/:orderNumber/cancel", requireAuth, async (c) => {
  const user = c.get("user")!;
  const orderNumber = c.req.param("orderNumber");

  try {
    const data = await cancelMyOrder(orderNumber, user.id);
    return c.json({ success: true, data });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to cancel order" },
      (e.statusCode as 400 | 404 | 500) ?? 500,
    );
  }
});

// ─── POST /api/orders/webhook/razorpay ───────────────────────────────────────
// Razorpay webhook — server-side payment confirmation fallback.
// No auth needed — verified via webhook signature.

ordersPublic.post("/webhook/razorpay", async (c) => {
  const signature = c.req.header("x-razorpay-signature") ?? "";
  const rawBody = await c.req.text();

  try {
    await handleRazorpayWebhook(rawBody, signature);
    return c.json({ success: true });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message },
      (e.statusCode as 400 | 500) ?? 500,
    );
  }
});

export { ordersPublic };
