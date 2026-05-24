import { Hono } from "hono";
import { z } from "zod";
import type { HonoVariables } from "../../types/hono.ts";
import { requireAdmin } from "../../middleware/auth.middleware.ts";
import { validateBody } from "../../middleware/validate.middleware.ts";
import {
  adminGetReviews,
  approveReview,
  addAdminReply,
  adminDeleteReview,
} from "../../services/review.service.ts";

const reviewsAdmin = new Hono<{ Variables: HonoVariables }>();
reviewsAdmin.use("/*", requireAdmin);

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const adminReplySchema = z.object({
  adminReply: z.string().min(1).max(2000),
});

// ─── GET /api/admin/reviews ───────────────────────────────────────────────────
// List all reviews with optional filters.
//
// Query params:
//   cakeId   — filter by cake
//   approved — "true" | "false"
//   page, limit

reviewsAdmin.get("/", async (c) => {
  const result = await adminGetReviews(c.req.query());
  return c.json({ success: true, ...result });
});

// ─── PATCH /api/admin/reviews/:id/approve ─────────────────────────────────────
// Approve a review → becomes publicly visible + recalculates cake rating.

reviewsAdmin.patch("/:id/approve", async (c) => {
  const reviewId = c.req.param("id");

  try {
    const data = await approveReview(reviewId);
    return c.json({ success: true, data });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to approve review" },
      (e.statusCode as 404 | 500) ?? 500,
    );
  }
});

// ─── PATCH /api/admin/reviews/:id/reply ──────────────────────────────────────
// Add or update the admin reply on a review.

reviewsAdmin.patch(
  "/:id/reply",
  validateBody(adminReplySchema),
  async (c) => {
    const reviewId = c.req.param("id");
    const { adminReply } = c.get("validatedBody") as z.infer<
      typeof adminReplySchema
    >;

    try {
      const data = await addAdminReply(reviewId, adminReply);
      return c.json({ success: true, data });
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number };
      return c.json(
        { success: false, error: e.message ?? "Failed to add reply" },
        (e.statusCode as 404 | 500) ?? 500,
      );
    }
  },
);

// ─── DELETE /api/admin/reviews/:id ───────────────────────────────────────────
// Admin delete any review + recalculate cake rating.

reviewsAdmin.delete("/:id", async (c) => {
  const reviewId = c.req.param("id");

  try {
    await adminDeleteReview(reviewId);
    return c.json({ success: true, message: "Review deleted" });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to delete review" },
      (e.statusCode as 404 | 500) ?? 500,
    );
  }
});

export { reviewsAdmin };
