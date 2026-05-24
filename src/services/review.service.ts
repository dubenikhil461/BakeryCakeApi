import { and, avg, count, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { review, cake, order, orderItem } from "../db/schema/app-schema.ts";
import { newId } from "../lib/id.ts";
import { paginate, parsePagination } from "../lib/pagination.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Recalculate cake.avgRating and cake.reviewCount from approved reviews.
 * Called after every create/update/delete that changes approval state.
 */
async function recalculateRating(cakeId: string): Promise<void> {
  const [agg] = await db
    .select({
      avgRating: avg(review.rating),
      total: count(),
    })
    .from(review)
    .where(and(eq(review.cakeId, cakeId), eq(review.isApproved, true)));

  await db
    .update(cake)
    .set({
      avgRating: agg.avgRating ?? "0.00",
      reviewCount: Number(agg.total ?? 0),
    })
    .where(eq(cake.id, cakeId));
}

// ─── Public ───────────────────────────────────────────────────────────────────

/**
 * List approved reviews for a cake (public-facing, paginated).
 */
export async function getReviewsForCake(
  cakeId: string,
  query: Record<string, string>,
) {
  const { page, limit, offset } = parsePagination(query);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(review)
      .where(and(eq(review.cakeId, cakeId), eq(review.isApproved, true)))
      .orderBy(desc(review.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(review)
      .where(and(eq(review.cakeId, cakeId), eq(review.isApproved, true))),
  ]);

  return paginate(rows, Number(total), page, limit);
}

// ─── Authenticated ────────────────────────────────────────────────────────────

export interface CreateReviewInput {
  cakeId: string;
  rating: number; // 1-5
  title?: string;
  body?: string;
}

/**
 * Create a review. Checks:
 * - User hasn't already reviewed this cake (unique index will also catch this)
 * - User has a delivered order that contains this cake → isVerifiedPurchase = true
 */
export async function createReview(
  userId: string,
  input: CreateReviewInput,
): Promise<typeof review.$inferSelect> {
  const { cakeId, rating, title, body } = input;

  // Check the cake exists
  const [cakeRow] = await db
    .select({ id: cake.id })
    .from(cake)
    .where(eq(cake.id, cakeId));
  if (!cakeRow) {
    const err = new Error("Cake not found") as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  // Check duplicate review
  const [existing] = await db
    .select({ id: review.id })
    .from(review)
    .where(and(eq(review.userId, userId), eq(review.cakeId, cakeId)));
  if (existing) {
    const err = new Error(
      "You have already reviewed this cake",
    ) as Error & { statusCode: number };
    err.statusCode = 409;
    throw err;
  }

  // Check for a verified purchase (delivered order containing this cake)
  const [verifiedOrder] = await db
    .select({ orderId: order.id })
    .from(order)
    .innerJoin(orderItem, eq(orderItem.orderId, order.id))
    .where(
      and(
        eq(order.userId, userId),
        eq(order.status, "delivered"),
        eq(orderItem.cakeId, cakeId),
      ),
    )
    .limit(1);

  const isVerifiedPurchase = Boolean(verifiedOrder);
  const id = newId();

  await db.insert(review).values({
    id,
    cakeId,
    userId,
    orderId: verifiedOrder?.orderId ?? null,
    rating,
    title: title ?? null,
    body: body ?? null,
    isVerifiedPurchase,
    // needs admin approval before showing publicly
    isApproved: false,
  });

  const [newReview] = await db
    .select()
    .from(review)
    .where(eq(review.id, id));

  return newReview;
}

/**
 * Update own review. Resets isApproved so admin must re-approve.
 */
export async function updateReview(
  reviewId: string,
  userId: string,
  input: Partial<Pick<CreateReviewInput, "rating" | "title" | "body">>,
): Promise<typeof review.$inferSelect> {
  const [existing] = await db
    .select()
    .from(review)
    .where(eq(review.id, reviewId));

  if (!existing) {
    const err = new Error("Review not found") as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }
  if (existing.userId !== userId) {
    const err = new Error("Forbidden") as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }

  await db
    .update(review)
    .set({
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      // reset approval — admin needs to re-approve after edits
      isApproved: false,
    })
    .where(eq(review.id, reviewId));

  // Recalculate (this review is no longer approved)
  await recalculateRating(existing.cakeId);

  const [updated] = await db.select().from(review).where(eq(review.id, reviewId));
  return updated;
}

/**
 * Delete own review.
 */
export async function deleteReview(
  reviewId: string,
  userId: string,
): Promise<void> {
  const [existing] = await db
    .select()
    .from(review)
    .where(eq(review.id, reviewId));

  if (!existing) {
    const err = new Error("Review not found") as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }
  if (existing.userId !== userId) {
    const err = new Error("Forbidden") as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }

  await db.delete(review).where(eq(review.id, reviewId));
  await recalculateRating(existing.cakeId);
}

// ─── Admin ────────────────────────────────────────────────────────────────────

/**
 * List all reviews with optional filters.
 */
export async function adminGetReviews(query: Record<string, string>) {
  const { page, limit, offset } = parsePagination(query);

  const conditions = [];
  if (query.cakeId) conditions.push(eq(review.cakeId, query.cakeId));
  if (query.approved === "true") conditions.push(eq(review.isApproved, true));
  if (query.approved === "false") conditions.push(eq(review.isApproved, false));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(review)
      .where(where)
      .orderBy(desc(review.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(review).where(where),
  ]);

  return paginate(rows, Number(total), page, limit);
}

/**
 * Approve a review → becomes publicly visible + recalculate rating.
 */
export async function approveReview(
  reviewId: string,
): Promise<typeof review.$inferSelect> {
  const [existing] = await db
    .select()
    .from(review)
    .where(eq(review.id, reviewId));

  if (!existing) {
    const err = new Error("Review not found") as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  await db
    .update(review)
    .set({ isApproved: true })
    .where(eq(review.id, reviewId));

  await recalculateRating(existing.cakeId);

  const [updated] = await db.select().from(review).where(eq(review.id, reviewId));
  return updated;
}

/**
 * Add or update admin reply on a review.
 */
export async function addAdminReply(
  reviewId: string,
  adminReply: string,
): Promise<typeof review.$inferSelect> {
  const [existing] = await db
    .select()
    .from(review)
    .where(eq(review.id, reviewId));

  if (!existing) {
    const err = new Error("Review not found") as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  await db
    .update(review)
    .set({ adminReply })
    .where(eq(review.id, reviewId));

  const [updated] = await db.select().from(review).where(eq(review.id, reviewId));
  return updated;
}

/**
 * Admin delete any review.
 */
export async function adminDeleteReview(reviewId: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(review)
    .where(eq(review.id, reviewId));

  if (!existing) {
    const err = new Error("Review not found") as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  await db.delete(review).where(eq(review.id, reviewId));
  await recalculateRating(existing.cakeId);
}
