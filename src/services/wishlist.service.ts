import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { wishlist, cake, cakeImage } from "../db/schema/app-schema.ts";
import { newId } from "../lib/id.ts";

// ─── Wishlist Service ─────────────────────────────────────────────────────────

/**
 * Get the user's wishlist with cake details and primary image.
 */
export async function getWishlist(userId: string) {
  // Fetch wishlist rows joined with cake + primary image
  const rows = await db
    .select({
      wishlistId: wishlist.id,
      addedAt: wishlist.createdAt,
      cake: {
        id: cake.id,
        name: cake.name,
        slug: cake.slug,
        basePrice: cake.basePrice,
        avgRating: cake.avgRating,
        reviewCount: cake.reviewCount,
        isFeatured: cake.isFeatured,
        isActive: cake.isActive,
      },
    })
    .from(wishlist)
    .innerJoin(cake, eq(cake.id, wishlist.cakeId))
    // Only return active cakes — deleted (cascade) or deactivated cakes are excluded
    .where(and(eq(wishlist.userId, userId), eq(cake.isActive, true)))
    .orderBy(desc(wishlist.createdAt));

  // Fetch primary images for all wishlist cakes in one query
  const cakeIds = rows.map((r) => r.cake.id);
  let imageMap: Record<string, string | null> = {};

  if (cakeIds.length > 0) {
    const images = await db
      .select({ cakeId: cakeImage.cakeId, url: cakeImage.url })
      .from(cakeImage)
      .where(
        and(
          eq(cakeImage.isPrimary, true),
          // MySQL IN clause — Drizzle handles this with inArray but we can also use a workaround
          // since we already have cakeIds, filter in JS for simplicity
        ),
      );

    // Filter to only our cake IDs and build map
    images
      .filter((img) => cakeIds.includes(img.cakeId))
      .forEach((img) => {
        imageMap[img.cakeId] = img.url;
      });
  }

  return rows.map((r) => ({
    id: r.wishlistId,
    addedAt: r.addedAt,
    cake: {
      ...r.cake,
      imageUrl: imageMap[r.cake.id] ?? null,
    },
  }));
}

/**
 * Add a cake to the wishlist. Idempotent — silently succeeds if already exists.
 */
export async function addToWishlist(
  userId: string,
  cakeId: string,
): Promise<{ id: string; cakeId: string; addedAt: Date }> {
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

  // Check if already wishlisted
  const [existing] = await db
    .select()
    .from(wishlist)
    .where(and(eq(wishlist.userId, userId), eq(wishlist.cakeId, cakeId)));

  if (existing) {
    return { id: existing.id, cakeId: existing.cakeId, addedAt: existing.createdAt };
  }

  const id = newId();
  await db.insert(wishlist).values({ id, userId, cakeId });

  const [created] = await db.select().from(wishlist).where(eq(wishlist.id, id));
  return { id: created.id, cakeId: created.cakeId, addedAt: created.createdAt };
}

/**
 * Remove a cake from the wishlist.
 */
export async function removeFromWishlist(
  userId: string,
  cakeId: string,
): Promise<void> {
  const [existing] = await db
    .select({ id: wishlist.id })
    .from(wishlist)
    .where(and(eq(wishlist.userId, userId), eq(wishlist.cakeId, cakeId)));

  if (!existing) {
    const err = new Error("Item not in wishlist") as Error & {
      statusCode: number;
    };
    err.statusCode = 404;
    throw err;
  }

  await db
    .delete(wishlist)
    .where(and(eq(wishlist.userId, userId), eq(wishlist.cakeId, cakeId)));
}
