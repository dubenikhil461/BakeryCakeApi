import { Hono } from "hono";
import { z } from "zod";
import type { HonoVariables } from "../../types/hono.ts";
import { requireAuth } from "../../middleware/auth.middleware.ts";
import { validateBody } from "../../middleware/validate.middleware.ts";
import {
  getReviewsForCake,
  createReview,
  updateReview,
  deleteReview,
} from "../../services/review.service.ts";

const reviewsPublic = new Hono<{ Variables: HonoVariables }>();

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const createReviewSchema = z.object({
  cakeId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  body: z.string().max(2000).optional(),
});

const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().max(200).optional(),
  body: z.string().max(2000).optional(),
});

// ─── GET /api/reviews?cakeId= ─────────────────────────────────────────────────
// Public: list approved reviews for a cake.

reviewsPublic.get("/", async (c) => {
  const cakeId = c.req.query("cakeId");
  if (!cakeId) {
    return c.json({ success: false, error: "cakeId query param is required" }, 400);
  }

  const result = await getReviewsForCake(cakeId, c.req.query());
  return c.json({ success: true, ...result });
});

// ─── POST /api/reviews ────────────────────────────────────────────────────────
// Authenticated: submit a review.

reviewsPublic.post(
  "/",
  requireAuth,
  validateBody(createReviewSchema),
  async (c) => {
    const user = c.get("user")!;
    const input = c.get("validatedBody") as z.infer<typeof createReviewSchema>;

    try {
      const data = await createReview(user.id, input);
      return c.json({ success: true, data }, 201);
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number };
      return c.json(
        { success: false, error: e.message ?? "Failed to create review" },
        (e.statusCode as 400 | 404 | 409 | 500) ?? 500,
      );
    }
  },
);

// ─── PUT /api/reviews/:id ─────────────────────────────────────────────────────
// Authenticated: edit own review (resets approval).

reviewsPublic.put(
  "/:id",
  requireAuth,
  validateBody(updateReviewSchema),
  async (c) => {
    const user = c.get("user")!;
    const reviewId = c.req.param("id");
    const input = c.get("validatedBody") as z.infer<typeof updateReviewSchema>;

    try {
      const data = await updateReview(reviewId, user.id, input);
      return c.json({ success: true, data });
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number };
      return c.json(
        { success: false, error: e.message ?? "Failed to update review" },
        (e.statusCode as 403 | 404 | 500) ?? 500,
      );
    }
  },
);

// ─── DELETE /api/reviews/:id ──────────────────────────────────────────────────
// Authenticated: delete own review.

reviewsPublic.delete("/:id", requireAuth, async (c) => {
  const user = c.get("user")!;
  const reviewId = c.req.param("id");

  try {
    await deleteReview(reviewId, user.id);
    return c.json({ success: true, message: "Review deleted" });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to delete review" },
      (e.statusCode as 403 | 404 | 500) ?? 500,
    );
  }
});

export { reviewsPublic };
