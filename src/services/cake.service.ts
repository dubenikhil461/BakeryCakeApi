import { and, eq, inArray, sql } from "drizzle-orm";
import { cloudinary } from "../lib/cloudinary.ts";
import { db } from "../db/index.ts";
import {
  cake,
  cakeImage,
  cakeVariant,
  cakeTag,
  tag,
  upload,
} from "../db/schema/app-schema.ts";
import { newId } from "../lib/id.ts";
import { toSlug, uniqueSlug } from "../lib/slug.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateCakeInput {
  name: string;
  description?: string;
  shortDescription?: string;
  categoryId?: string;
  basePrice: string; // decimal string e.g. "450.00"
  isFeatured?: boolean;
  isActive?: boolean;
  isBestseller?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  tags?: string[]; // tag names — created if they don't exist
}

export interface UpdateCakeInput extends Partial<CreateCakeInput> {
  name?: string;
}

export interface AddVariantInput {
  variantType: "size" | "weight" | "flavor" | "tier";
  name: string;
  priceModifier?: string;
  stockQty?: number;
  sku?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface AttachImageInput {
  uploadId: string;
  altText?: string;
  isPrimary?: boolean;
  sortOrder?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Find or create tags by name. Returns array of tag IDs. */
async function resolveTagIds(tagNames: string[]): Promise<string[]> {
  const ids: string[] = [];

  for (const name of tagNames) {
    const slug = toSlug(name);
    const [existing] = await db
      .select({ id: tag.id })
      .from(tag)
      .where(eq(tag.slug, slug))
      .limit(1);

    if (existing) {
      ids.push(existing.id);
    } else {
      const id = newId();
      await db.insert(tag).values({ id, name, slug });
      ids.push(id);
    }
  }

  return ids;
}

/** Generate a unique slug for a cake. */
async function generateCakeSlug(name: string): Promise<string> {
  const base = toSlug(name);

  // check if base slug is free
  const [existing] = await db
    .select({ id: cake.id })
    .from(cake)
    .where(eq(cake.slug, base))
    .limit(1);

  return existing ? uniqueSlug(name) : base;
}

// ─── Cake CRUD ────────────────────────────────────────────────────────────────

export async function createCake(input: CreateCakeInput) {
  const id = newId();
  const slug = await generateCakeSlug(input.name);

  await db.insert(cake).values({
    id,
    name: input.name,
    slug,
    description: input.description,
    shortDescription: input.shortDescription,
    categoryId: input.categoryId,
    basePrice: input.basePrice,
    isFeatured: input.isFeatured ?? false,
    isActive: input.isActive ?? true,
    isBestseller: input.isBestseller ?? false,
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
  });

  // attach tags if provided
  if (input.tags && input.tags.length > 0) {
    const tagIds = await resolveTagIds(input.tags);
    await db.insert(cakeTag).values(tagIds.map((tagId) => ({ cakeId: id, tagId })));
  }

  return getCakeById(id);
}

export async function updateCake(id: string, input: UpdateCakeInput) {
  const [existing] = await db
    .select()
    .from(cake)
    .where(eq(cake.id, id))
    .limit(1);

  if (!existing) {
    throw Object.assign(new Error("Cake not found"), { statusCode: 404 });
  }

  // regenerate slug only if name changed
  let slug = existing.slug;
  if (input.name && input.name !== existing.name) {
    slug = await generateCakeSlug(input.name);
  }

  await db
    .update(cake)
    .set({
      ...(input.name && { name: input.name, slug }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.shortDescription !== undefined && {
        shortDescription: input.shortDescription,
      }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.basePrice !== undefined && { basePrice: input.basePrice }),
      ...(input.isFeatured !== undefined && { isFeatured: input.isFeatured }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.isBestseller !== undefined && { isBestseller: input.isBestseller }),
      ...(input.metaTitle !== undefined && { metaTitle: input.metaTitle }),
      ...(input.metaDescription !== undefined && {
        metaDescription: input.metaDescription,
      }),
    })
    .where(eq(cake.id, id));

  // re-sync tags if provided
  if (input.tags !== undefined) {
    await db.delete(cakeTag).where(eq(cakeTag.cakeId, id));
    if (input.tags.length > 0) {
      const tagIds = await resolveTagIds(input.tags);
      await db
        .insert(cakeTag)
        .values(tagIds.map((tagId) => ({ cakeId: id, tagId })));
    }
  }

  return getCakeById(id);
}

/** Soft delete — sets isActive = false rather than deleting the row. */
export async function softDeleteCake(id: string) {
  const [existing] = await db
    .select({ id: cake.id })
    .from(cake)
    .where(eq(cake.id, id))
    .limit(1);

  if (!existing) {
    throw Object.assign(new Error("Cake not found"), { statusCode: 404 });
  }

  await db.update(cake).set({ isActive: false }).where(eq(cake.id, id));
}

export async function getCakeById(id: string) {
  const [row] = await db.select().from(cake).where(eq(cake.id, id)).limit(1);
  return row ?? null;
}

// ─── Image Management ─────────────────────────────────────────────────────────

export async function attachImageToCake(cakeId: string, input: AttachImageInput) {
  // fetch upload record to get url and storageKey
  const [uploadRecord] = await db
    .select()
    .from(upload)
    .where(eq(upload.id, input.uploadId))
    .limit(1);

  if (!uploadRecord) {
    throw Object.assign(new Error("Upload not found"), { statusCode: 404 });
  }

  // verify cake exists
  const [cakeRow] = await db
    .select({ id: cake.id })
    .from(cake)
    .where(eq(cake.id, cakeId))
    .limit(1);

  if (!cakeRow) {
    throw Object.assign(new Error("Cake not found"), { statusCode: 404 });
  }

  // if this is the first image or isPrimary requested, unset other primary flags
  if (input.isPrimary) {
    await db
      .update(cakeImage)
      .set({ isPrimary: false })
      .where(eq(cakeImage.cakeId, cakeId));
  }

  const imageId = newId();
  await db.insert(cakeImage).values({
    id: imageId,
    cakeId,
    url: uploadRecord.publicUrl,
    storageKey: uploadRecord.storageKey,
    altText: input.altText,
    isPrimary: input.isPrimary ?? false,
    sortOrder: input.sortOrder ?? 0,
  });

  // link the upload record to this cake
  await db
    .update(upload)
    .set({ linkedEntityType: "cake", linkedEntityId: cakeId })
    .where(eq(upload.id, input.uploadId));

  return db
    .select()
    .from(cakeImage)
    .where(eq(cakeImage.id, imageId))
    .limit(1)
    .then((r) => r[0]);
}

export async function detachImageFromCake(cakeId: string, imageId: string) {
  const [img] = await db
    .select()
    .from(cakeImage)
    .where(and(eq(cakeImage.id, imageId), eq(cakeImage.cakeId, cakeId)))
    .limit(1);

  if (!img) {
    throw Object.assign(new Error("Image not found on this cake"), {
      statusCode: 404,
    });
  }

  // delete from Cloudinary
  await cloudinary.uploader.destroy(img.storageKey);

  // delete cake_image row
  await db.delete(cakeImage).where(eq(cakeImage.id, imageId));

  // delete upload record
  await db.delete(upload).where(eq(upload.storageKey, img.storageKey));
}

export async function setPrimaryImage(cakeId: string, imageId: string) {
  // verify image belongs to cake
  const [img] = await db
    .select({ id: cakeImage.id })
    .from(cakeImage)
    .where(and(eq(cakeImage.id, imageId), eq(cakeImage.cakeId, cakeId)))
    .limit(1);

  if (!img) {
    throw Object.assign(new Error("Image not found on this cake"), {
      statusCode: 404,
    });
  }

  // unset all primary flags for this cake, then set the target
  await db
    .update(cakeImage)
    .set({ isPrimary: false })
    .where(eq(cakeImage.cakeId, cakeId));

  await db
    .update(cakeImage)
    .set({ isPrimary: true })
    .where(eq(cakeImage.id, imageId));
}

// ─── Variant Management ───────────────────────────────────────────────────────

export async function addVariant(cakeId: string, input: AddVariantInput) {
  const [cakeRow] = await db
    .select({ id: cake.id })
    .from(cake)
    .where(eq(cake.id, cakeId))
    .limit(1);

  if (!cakeRow) {
    throw Object.assign(new Error("Cake not found"), { statusCode: 404 });
  }

  const id = newId();
  await db.insert(cakeVariant).values({
    id,
    cakeId,
    variantType: input.variantType,
    name: input.name,
    priceModifier: input.priceModifier ?? "0.00",
    stockQty: input.stockQty ?? 0,
    sku: input.sku,
    isActive: input.isActive ?? true,
    sortOrder: input.sortOrder ?? 0,
  });

  return db
    .select()
    .from(cakeVariant)
    .where(eq(cakeVariant.id, id))
    .limit(1)
    .then((r) => r[0]);
}

export async function updateVariant(
  cakeId: string,
  variantId: string,
  input: Partial<AddVariantInput>,
) {
  const [variant] = await db
    .select()
    .from(cakeVariant)
    .where(and(eq(cakeVariant.id, variantId), eq(cakeVariant.cakeId, cakeId)))
    .limit(1);

  if (!variant) {
    throw Object.assign(new Error("Variant not found on this cake"), {
      statusCode: 404,
    });
  }

  await db
    .update(cakeVariant)
    .set({
      ...(input.variantType !== undefined && { variantType: input.variantType }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.priceModifier !== undefined && {
        priceModifier: input.priceModifier,
      }),
      ...(input.stockQty !== undefined && { stockQty: input.stockQty }),
      ...(input.sku !== undefined && { sku: input.sku }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    })
    .where(eq(cakeVariant.id, variantId));

  return db
    .select()
    .from(cakeVariant)
    .where(eq(cakeVariant.id, variantId))
    .limit(1)
    .then((r) => r[0]);
}

export async function removeVariant(cakeId: string, variantId: string) {
  const [variant] = await db
    .select({ id: cakeVariant.id })
    .from(cakeVariant)
    .where(and(eq(cakeVariant.id, variantId), eq(cakeVariant.cakeId, cakeId)))
    .limit(1);

  if (!variant) {
    throw Object.assign(new Error("Variant not found on this cake"), {
      statusCode: 404,
    });
  }

  await db.delete(cakeVariant).where(eq(cakeVariant.id, variantId));
}

// ─── Review Aggregate Recalculation ──────────────────────────────────────────
// Called from review service after create/update/delete

export async function recalculateRating(cakeId: string) {
  await db
    .update(cake)
    .set({
      avgRating: sql`(
        SELECT COALESCE(AVG(rating), 0)
        FROM review
        WHERE cake_id = ${cakeId} AND is_approved = true
      )`,
      reviewCount: sql`(
        SELECT COUNT(*)
        FROM review
        WHERE cake_id = ${cakeId} AND is_approved = true
      )`,
    })
    .where(eq(cake.id, cakeId));
}
