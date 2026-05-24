import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import {
  cart,
  cartItem,
  cake,
  cakeVariant,
  cakeImage,
} from "../db/schema/app-schema.ts";
import { newId } from "../lib/id.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddItemInput {
  cakeId: string;
  variantId?: string | null;
  quantity?: number;
  customMessage?: string;
  deliveryDate?: string; // ISO date string
}

export interface UpdateItemInput {
  quantity?: number;
  customMessage?: string;
  deliveryDate?: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Recalculate cart.subtotal from all cart_item rows. Uses SQL to avoid float drift. */
async function recalculateSubtotal(cartId: string) {
  await db
    .update(cart)
    .set({
      subtotal: sql`(
        SELECT COALESCE(SUM(unit_price * quantity), 0.00)
        FROM cart_item
        WHERE cart_id = ${cartId}
      )`,
    })
    .where(eq(cart.id, cartId));
}

/** Find an existing cart item matching (cartId + cakeId + variantId).
 *  Handles NULL variantId correctly — MySQL treats NULL != NULL in unique indexes,
 *  so we need isNull() instead of eq() when variantId is absent. */
async function findExistingItem(
  cartId: string,
  cakeId: string,
  variantId: string | null | undefined,
) {
  const condition =
    variantId
      ? and(
          eq(cartItem.cartId, cartId),
          eq(cartItem.cakeId, cakeId),
          eq(cartItem.variantId, variantId),
        )
      : and(
          eq(cartItem.cartId, cartId),
          eq(cartItem.cakeId, cakeId),
          isNull(cartItem.variantId),
        );

  const [item] = await db.select().from(cartItem).where(condition).limit(1);
  return item ?? null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get the user's cart with all items, or create one if it doesn't exist.
 * Returns cart + enriched items (cake name, primary image, variant name).
 */
export async function getOrCreateCart(userId: string) {
  // Find or create cart row
  let [cartRow] = await db
    .select()
    .from(cart)
    .where(eq(cart.userId, userId))
    .limit(1);

  if (!cartRow) {
    const id = newId();
    await db.insert(cart).values({ id, userId, subtotal: "0.00" });
    [cartRow] = await db
      .select()
      .from(cart)
      .where(eq(cart.id, id))
      .limit(1);
  }

  // Fetch items with cake and variant details
  const items = await db
    .select({
      // cart item fields
      id: cartItem.id,
      quantity: cartItem.quantity,
      unitPrice: cartItem.unitPrice,
      customMessage: cartItem.customMessage,
      deliveryDate: cartItem.deliveryDate,
      createdAt: cartItem.createdAt,
      // cake fields
      cake: {
        id: cake.id,
        name: cake.name,
        slug: cake.slug,
        basePrice: cake.basePrice,
        isActive: cake.isActive,
      },
      // variant fields (may be null)
      variant: {
        id: cakeVariant.id,
        name: cakeVariant.name,
        variantType: cakeVariant.variantType,
        priceModifier: cakeVariant.priceModifier,
      },
    })
    .from(cartItem)
    .innerJoin(cake, eq(cartItem.cakeId, cake.id))
    .leftJoin(cakeVariant, eq(cartItem.variantId, cakeVariant.id))
    .where(eq(cartItem.cartId, cartRow!.id))
    .orderBy(asc(cartItem.createdAt));

  // Batch fetch primary images for items
  const cakeIds = [...new Set(items.map((i) => i.cake.id))];
  let imageMap = new Map<string, string>();

  if (cakeIds.length > 0) {
    const { inArray } = await import("drizzle-orm");
    const images = await db
      .select({ cakeId: cakeImage.cakeId, url: cakeImage.url })
      .from(cakeImage)
      .where(and(inArray(cakeImage.cakeId, cakeIds), eq(cakeImage.isPrimary, true)));
    imageMap = new Map(images.map((img) => [img.cakeId, img.url]));
  }

  const enrichedItems = items.map((item) => ({
    ...item,
    cake: {
      ...item.cake,
      primaryImageUrl: imageMap.get(item.cake.id) ?? null,
    },
  }));

  return { ...cartRow!, items: enrichedItems };
}

/**
 * Add a cake (+ optional variant) to the user's cart.
 *  - If the same (cakeId + variantId) already exists → increment quantity.
 *  - Otherwise insert a new row with price snapshot.
 */
export async function addItem(userId: string, input: AddItemInput) {
  const qty = Math.max(1, input.quantity ?? 1);

  // Validate cake exists and is active
  const [cakeRow] = await db
    .select({ id: cake.id, basePrice: cake.basePrice, isActive: cake.isActive })
    .from(cake)
    .where(eq(cake.id, input.cakeId))
    .limit(1);

  if (!cakeRow) {
    throw Object.assign(new Error("Cake not found"), { statusCode: 404 });
  }
  if (!cakeRow.isActive) {
    throw Object.assign(new Error("This cake is no longer available"), {
      statusCode: 400,
    });
  }

  // Validate variant if provided
  let priceModifier = 0;
  if (input.variantId) {
    const [variantRow] = await db
      .select({ id: cakeVariant.id, priceModifier: cakeVariant.priceModifier, isActive: cakeVariant.isActive })
      .from(cakeVariant)
      .where(
        and(eq(cakeVariant.id, input.variantId), eq(cakeVariant.cakeId, input.cakeId)),
      )
      .limit(1);

    if (!variantRow) {
      throw Object.assign(new Error("Variant not found on this cake"), {
        statusCode: 404,
      });
    }
    if (!variantRow.isActive) {
      throw Object.assign(new Error("This variant is no longer available"), {
        statusCode: 400,
      });
    }
    priceModifier = parseFloat(variantRow.priceModifier);
  }

  // Get or create cart
  const cartData = await getOrCreateCart(userId);
  const cartId = cartData.id;

  // Snapshot price at time of add
  const unitPrice = (parseFloat(cakeRow.basePrice) + priceModifier).toFixed(2);

  // Upsert: increment if same item already in cart
  const existing = await findExistingItem(cartId, input.cakeId, input.variantId);

  if (existing) {
    await db
      .update(cartItem)
      .set({ quantity: existing.quantity + qty })
      .where(eq(cartItem.id, existing.id));
  } else {
    await db.insert(cartItem).values({
      id: newId(),
      cartId,
      cakeId: input.cakeId,
      variantId: input.variantId ?? null,
      quantity: qty,
      unitPrice,
      customMessage: input.customMessage,
      deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : undefined,
    });
  }

  await recalculateSubtotal(cartId);
  return getOrCreateCart(userId);
}

/**
 * Update quantity, custom message, or delivery date on a cart item.
 * Setting quantity to 0 removes the item.
 */
export async function updateItem(
  userId: string,
  itemId: string,
  input: UpdateItemInput,
) {
  // Verify item belongs to the user's cart
  const [cartRow] = await db
    .select({ id: cart.id })
    .from(cart)
    .where(eq(cart.userId, userId))
    .limit(1);

  if (!cartRow) {
    throw Object.assign(new Error("Cart not found"), { statusCode: 404 });
  }

  const [item] = await db
    .select()
    .from(cartItem)
    .where(and(eq(cartItem.id, itemId), eq(cartItem.cartId, cartRow.id)))
    .limit(1);

  if (!item) {
    throw Object.assign(new Error("Cart item not found"), { statusCode: 404 });
  }

  // quantity = 0 → remove item
  if (input.quantity !== undefined && input.quantity <= 0) {
    await db.delete(cartItem).where(eq(cartItem.id, itemId));
    await recalculateSubtotal(cartRow.id);
    return getOrCreateCart(userId);
  }

  await db
    .update(cartItem)
    .set({
      ...(input.quantity !== undefined && { quantity: input.quantity }),
      ...(input.customMessage !== undefined && {
        customMessage: input.customMessage,
      }),
      ...(input.deliveryDate !== undefined && {
        deliveryDate: new Date(input.deliveryDate),
      }),
    })
    .where(eq(cartItem.id, itemId));

  await recalculateSubtotal(cartRow.id);
  return getOrCreateCart(userId);
}

/** Remove a single item from the cart. */
export async function removeItem(userId: string, itemId: string) {
  const [cartRow] = await db
    .select({ id: cart.id })
    .from(cart)
    .where(eq(cart.userId, userId))
    .limit(1);

  if (!cartRow) {
    throw Object.assign(new Error("Cart not found"), { statusCode: 404 });
  }

  const [item] = await db
    .select({ id: cartItem.id })
    .from(cartItem)
    .where(and(eq(cartItem.id, itemId), eq(cartItem.cartId, cartRow.id)))
    .limit(1);

  if (!item) {
    throw Object.assign(new Error("Cart item not found"), { statusCode: 404 });
  }

  await db.delete(cartItem).where(eq(cartItem.id, itemId));
  await recalculateSubtotal(cartRow.id);
  return getOrCreateCart(userId);
}

/** Clear all items from the user's cart. */
export async function clearCart(userId: string) {
  const [cartRow] = await db
    .select({ id: cart.id })
    .from(cart)
    .where(eq(cart.userId, userId))
    .limit(1);

  if (!cartRow) return; // nothing to clear

  await db.delete(cartItem).where(eq(cartItem.cartId, cartRow.id));
  await db.update(cart).set({ subtotal: "0.00" }).where(eq(cart.id, cartRow.id));
}
