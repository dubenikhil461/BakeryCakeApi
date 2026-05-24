import { Hono } from "hono";
import { z } from "zod";
import type { HonoVariables } from "../../types/hono.ts";
import { requireAuth } from "../../middleware/auth.middleware.ts";
import { validateBody } from "../../middleware/validate.middleware.ts";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} from "../../services/wishlist.service.ts";

const wishlistRoutes = new Hono<{ Variables: HonoVariables }>();

// All wishlist routes require authentication
wishlistRoutes.use("/*", requireAuth);

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const addToWishlistSchema = z.object({
  cakeId: z.string().uuid(),
});

// ─── GET /api/wishlist ────────────────────────────────────────────────────────
// Get current user's wishlist with cake details.

wishlistRoutes.get("/", async (c) => {
  const user = c.get("user")!;

  try {
    const data = await getWishlist(user.id);
    return c.json({ success: true, data });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to fetch wishlist" },
      (e.statusCode as 500) ?? 500,
    );
  }
});

// ─── POST /api/wishlist ───────────────────────────────────────────────────────
// Add a cake to the wishlist (idempotent).

wishlistRoutes.post(
  "/",
  validateBody(addToWishlistSchema),
  async (c) => {
    const user = c.get("user")!;
    const { cakeId } = c.get("validatedBody") as z.infer<
      typeof addToWishlistSchema
    >;

    try {
      const data = await addToWishlist(user.id, cakeId);
      return c.json({ success: true, data }, 201);
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number };
      return c.json(
        { success: false, error: e.message ?? "Failed to add to wishlist" },
        (e.statusCode as 404 | 500) ?? 500,
      );
    }
  },
);

// ─── DELETE /api/wishlist/:cakeId ─────────────────────────────────────────────
// Remove a cake from the wishlist.

wishlistRoutes.delete("/:cakeId", async (c) => {
  const user = c.get("user")!;
  const cakeId = c.req.param("cakeId");

  try {
    await removeFromWishlist(user.id, cakeId);
    return c.json({ success: true, message: "Removed from wishlist" });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to remove from wishlist" },
      (e.statusCode as 404 | 500) ?? 500,
    );
  }
});

export { wishlistRoutes };
