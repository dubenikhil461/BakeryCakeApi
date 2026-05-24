import { Hono } from "hono";
import { z } from "zod";
import type { HonoVariables } from "../../types/hono.ts";
import { requireAuth } from "../../middleware/auth.middleware.ts";
import { validateBody } from "../../middleware/validate.middleware.ts";
import {
  getOrCreateCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
} from "../../services/cart.service.ts";

const cartRoutes = new Hono<{ Variables: HonoVariables }>();
cartRoutes.use("/*", requireAuth);

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const addItemSchema = z.object({
  cakeId: z.string().uuid(),
  variantId: z.string().uuid().optional().nullable(),
  quantity: z.number().int().min(1).max(50).optional(),
  customMessage: z.string().max(300).optional(),
  // ISO date string e.g. "2026-06-01"
  deliveryDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), "Invalid date format")
    .optional(),
});

const updateItemSchema = z
  .object({
    quantity: z.number().int().min(0).max(50).optional(),
    customMessage: z.string().max(300).optional(),
    deliveryDate: z
      .string()
      .refine((d) => !isNaN(Date.parse(d)), "Invalid date format")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

// ─── GET /api/cart ────────────────────────────────────────────────────────────
// Get (or create) the user's cart with enriched items.

cartRoutes.get("/", async (c) => {
  const user = c.get("user")!;
  const cartData = await getOrCreateCart(user.id);
  return c.json({ success: true, data: cartData });
});

// ─── POST /api/cart/items ─────────────────────────────────────────────────────
// Add a cake to the cart. Upserts quantity if same cake+variant already present.

cartRoutes.post("/items", validateBody(addItemSchema), async (c) => {
  const user = c.get("user")!;
  const input = c.get("validatedBody") as z.infer<typeof addItemSchema>;

  try {
    const cartData = await addItem(user.id, input);
    return c.json({ success: true, data: cartData });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to add item" },
      (e.statusCode as 400 | 404 | 500) ?? 500,
    );
  }
});

// ─── PATCH /api/cart/items/:id ────────────────────────────────────────────────
// Update quantity / message / delivery date.
// Setting quantity to 0 removes the item.

cartRoutes.patch("/items/:id", validateBody(updateItemSchema), async (c) => {
  const user = c.get("user")!;
  const itemId = c.req.param("id");
  const input = c.get("validatedBody") as z.infer<typeof updateItemSchema>;

  try {
    const cartData = await updateItem(user.id, itemId, input);
    return c.json({ success: true, data: cartData });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to update item" },
      (e.statusCode as 404 | 500) ?? 500,
    );
  }
});

// ─── DELETE /api/cart/items/:id ───────────────────────────────────────────────
// Remove a single item from the cart.

cartRoutes.delete("/items/:id", async (c) => {
  const user = c.get("user")!;
  const itemId = c.req.param("id");

  try {
    const cartData = await removeItem(user.id, itemId);
    return c.json({ success: true, data: cartData });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to remove item" },
      (e.statusCode as 404 | 500) ?? 500,
    );
  }
});

// ─── DELETE /api/cart ─────────────────────────────────────────────────────────
// Clear all items from the cart (cart row is kept, just emptied).

cartRoutes.delete("/", async (c) => {
  const user = c.get("user")!;
  await clearCart(user.id);
  return c.json({ success: true, message: "Cart cleared" });
});

export { cartRoutes };
