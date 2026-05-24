import { Hono } from "hono";
import { and, asc, count, desc, eq, gte, inArray, lte } from "drizzle-orm";
import type { HonoVariables } from "../../types/hono.ts";
import { db } from "../../db/index.ts";
import {
  cake,
  cakeImage,
  cakeVariant,
  cakeTag,
  tag,
  category,
  review,
} from "../../db/schema/app-schema.ts";
import { user } from "../../db/schema/auth-schema.ts";
import { parsePagination, paginate } from "../../lib/pagination.ts";

const cakesPublic = new Hono<{ Variables: HonoVariables }>();

// ─── GET /api/cakes ───────────────────────────────────────────────────────────
// Paginated public cake listing. Only isActive = true cakes.
//
// Query params:
//   category   — category slug
//   tag        — tag slug
//   minPrice   — minimum base price
//   maxPrice   — maximum base price
//   featured   — "true" to show only featured cakes
//   bestseller — "true" to show only bestsellers
//   search     — partial name match
//   sort       — price_asc | price_desc | newest | rating (default: newest)
//   page, limit

cakesPublic.get("/", async (c) => {
  const { page, limit, offset } = parsePagination(c.req.query());
  const q = c.req.query();

  // ── Resolve category slug → id ──────────────────────────────────────────
  let categoryId: string | undefined;
  if (q.category) {
    const [cat] = await db
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.slug, q.category), eq(category.isActive, true)))
      .limit(1);
    if (!cat) return c.json({ success: true, ...paginate([], 0, page, limit) });
    categoryId = cat.id;
  }

  // ── Resolve tag slug → cake ids ─────────────────────────────────────────
  let taggedCakeIds: string[] | undefined;
  if (q.tag) {
    const [tagRow] = await db
      .select({ id: tag.id })
      .from(tag)
      .where(eq(tag.slug, q.tag))
      .limit(1);

    if (!tagRow) return c.json({ success: true, ...paginate([], 0, page, limit) });

    const rows = await db
      .select({ cakeId: cakeTag.cakeId })
      .from(cakeTag)
      .where(eq(cakeTag.tagId, tagRow.id));

    taggedCakeIds = rows.map((r) => r.cakeId);
    if (taggedCakeIds.length === 0)
      return c.json({ success: true, ...paginate([], 0, page, limit) });
  }

  // ── Build WHERE conditions ───────────────────────────────────────────────
  const conditions = and(
    eq(cake.isActive, true),
    categoryId ? eq(cake.categoryId, categoryId) : undefined,
    taggedCakeIds ? inArray(cake.id, taggedCakeIds) : undefined,
    q.minPrice ? gte(cake.basePrice, q.minPrice) : undefined,
    q.maxPrice ? lte(cake.basePrice, q.maxPrice) : undefined,
    q.featured === "true" ? eq(cake.isFeatured, true) : undefined,
    q.bestseller === "true" ? eq(cake.isBestseller, true) : undefined,
  );

  // ── Count total ──────────────────────────────────────────────────────────
  const [{ total }] = await db
    .select({ total: count() })
    .from(cake)
    .where(conditions);

  // ── Sort order ───────────────────────────────────────────────────────────
  const orderCol =
    q.sort === "price_asc"
      ? asc(cake.basePrice)
      : q.sort === "price_desc"
        ? desc(cake.basePrice)
        : q.sort === "rating"
          ? desc(cake.avgRating)
          : desc(cake.createdAt); // default: newest

  // ── Fetch cake rows ──────────────────────────────────────────────────────
  const cakeRows = await db
    .select()
    .from(cake)
    .where(conditions)
    .orderBy(orderCol)
    .limit(limit)
    .offset(offset);

  if (cakeRows.length === 0)
    return c.json({ success: true, ...paginate([], total, page, limit) });

  const cakeIds = cakeRows.map((c) => c.id);

  // ── Batch fetch primary images ───────────────────────────────────────────
  const primaryImages = await db
    .select({
      cakeId: cakeImage.cakeId,
      url: cakeImage.url,
      altText: cakeImage.altText,
    })
    .from(cakeImage)
    .where(and(inArray(cakeImage.cakeId, cakeIds), eq(cakeImage.isPrimary, true)));

  const imageMap = new Map(primaryImages.map((img) => [img.cakeId, img]));

  // ── Assemble response ────────────────────────────────────────────────────
  const data = cakeRows.map((c) => ({
    ...c,
    primaryImage: imageMap.get(c.id) ?? null,
  }));

  return c.json({ success: true, ...paginate(data, total, page, limit) });
});

// ─── GET /api/cakes/:slug ─────────────────────────────────────────────────────
// Full cake detail: images, variants, tags, category, first-page reviews.

cakesPublic.get("/:slug", async (c) => {
  const slug = c.req.param("slug");

  // Fetch cake (active only)
  const [cakeRow] = await db
    .select()
    .from(cake)
    .where(and(eq(cake.slug, slug), eq(cake.isActive, true)))
    .limit(1);

  if (!cakeRow) {
    return c.json({ success: false, error: "Cake not found" }, 404);
  }

  // Fetch related data in parallel
  const [images, variants, tagRows, categoryRow, reviewsResult] =
    await Promise.all([
      // All images ordered by sortOrder
      db
        .select()
        .from(cakeImage)
        .where(eq(cakeImage.cakeId, cakeRow.id))
        .orderBy(asc(cakeImage.sortOrder)),

      // Active variants ordered by type then sortOrder
      db
        .select()
        .from(cakeVariant)
        .where(and(eq(cakeVariant.cakeId, cakeRow.id), eq(cakeVariant.isActive, true)))
        .orderBy(asc(cakeVariant.variantType), asc(cakeVariant.sortOrder)),

      // Tags via junction
      db
        .select({ id: tag.id, name: tag.name, slug: tag.slug })
        .from(cakeTag)
        .innerJoin(tag, eq(cakeTag.tagId, tag.id))
        .where(eq(cakeTag.cakeId, cakeRow.id)),

      // Category info
      cakeRow.categoryId
        ? db
            .select({
              id: category.id,
              name: category.name,
              slug: category.slug,
            })
            .from(category)
            .where(eq(category.id, cakeRow.categoryId))
            .limit(1)
            .then((r) => r[0] ?? null)
        : Promise.resolve(null),

      // First 10 approved reviews with reviewer name
      db
        .select({
          id: review.id,
          rating: review.rating,
          title: review.title,
          body: review.body,
          isVerifiedPurchase: review.isVerifiedPurchase,
          adminReply: review.adminReply,
          createdAt: review.createdAt,
          reviewer: { name: user.name },
        })
        .from(review)
        .innerJoin(user, eq(review.userId, user.id))
        .where(
          and(eq(review.cakeId, cakeRow.id), eq(review.isApproved, true)),
        )
        .orderBy(desc(review.createdAt))
        .limit(10),
    ]);

  return c.json({
    success: true,
    data: {
      ...cakeRow,
      category: categoryRow,
      images,
      variants,
      tags: tagRows,
      reviews: reviewsResult,
    },
  });
});

export { cakesPublic };
