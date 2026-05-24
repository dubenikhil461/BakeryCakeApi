import { Hono } from "hono";
import { and, asc, count, desc, eq, like, or } from "drizzle-orm";
import { z } from "zod";
import type { HonoVariables } from "../../types/hono.ts";
import { requireAdmin } from "../../middleware/auth.middleware.ts";
import { validateBody } from "../../middleware/validate.middleware.ts";
import { db } from "../../db/index.ts";
import { cake, cakeImage, cakeVariant, cakeTag, tag } from "../../db/schema/app-schema.ts";
import { parsePagination, paginate } from "../../lib/pagination.ts";
import {
  createCake,
  updateCake,
  hardDeleteCake,
  attachImageToCake,
  detachImageFromCake,
  setPrimaryImage,
  addVariant,
  updateVariant,
  removeVariant,
} from "../../services/cake.service.ts";

const cakes = new Hono<{ Variables: HonoVariables }>();
cakes.use("/*", requireAdmin);

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const createCakeSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  shortDescription: z.string().max(500).optional(),
  // Accept empty string from the UI (no category selected) and treat it as absent
  categoryId: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().uuid().optional(),
  ),
  // Accept both numeric (JSON default) and string representations
  basePrice: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid decimal e.g. '450.00'"),
    z.number().positive("Price must be positive").transform((n) => n.toFixed(2)),
  ]),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isBestseller: z.boolean().optional(),
  metaTitle: z.string().max(255).optional(),
  metaDescription: z.string().max(500).optional(),
  tags: z.array(z.string().min(1).max(80)).optional(),
});

const updateCakeSchema = createCakeSchema.partial();

const attachImageSchema = z.object({
  uploadId: z.string().uuid(),
  altText: z.string().max(255).optional(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const variantSchema = z.object({
  variantType: z.enum(["size", "weight", "flavor", "tier"]),
  name: z.string().min(1).max(100),
  priceModifier: z
    .union([
      z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Must be a valid decimal e.g. '50.00' or '-25.50'"),
      z.number().transform((n) => n.toFixed(2)),
    ])
    .optional(),
  stockQty: z.number().int().min(0).optional(),
  sku: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const updateVariantSchema = variantSchema.partial();

// ─── Helper: fetch full cake with images, variants, tags ─────────────────────

async function getCakeFull(id: string) {
  const [cakeRow] = await db
    .select()
    .from(cake)
    .where(eq(cake.id, id))
    .limit(1);

  if (!cakeRow) return null;

  const images = await db
    .select()
    .from(cakeImage)
    .where(eq(cakeImage.cakeId, id))
    .orderBy(asc(cakeImage.sortOrder));

  const variants = await db
    .select()
    .from(cakeVariant)
    .where(eq(cakeVariant.cakeId, id))
    .orderBy(asc(cakeVariant.sortOrder));

  const tagRows = await db
    .select({ id: tag.id, name: tag.name, slug: tag.slug })
    .from(cakeTag)
    .innerJoin(tag, eq(cakeTag.tagId, tag.id))
    .where(eq(cakeTag.cakeId, id));

  return { ...cakeRow, images, variants, tags: tagRows };
}

// ─── GET /api/admin/cakes ─────────────────────────────────────────────────────
// List all cakes (including inactive) with pagination + search.

cakes.get("/", async (c) => {
  const { page, limit, offset } = parsePagination(c.req.query());
  const search = c.req.query("search");
  const categoryId = c.req.query("categoryId");
  const isActive = c.req.query("isActive");
  const sortBy = c.req.query("sort") ?? "newest";

  const conditions = and(
    search
      ? or(like(cake.name, `%${search}%`), like(cake.slug, `%${search}%`))
      : undefined,
    categoryId ? eq(cake.categoryId, categoryId) : undefined,
    isActive !== undefined
      ? eq(cake.isActive, isActive === "true")
      : undefined,
  );

  const [{ total }] = await db
    .select({ total: count() })
    .from(cake)
    .where(conditions);

  const orderCol =
    sortBy === "price_asc"
      ? asc(cake.basePrice)
      : sortBy === "price_desc"
        ? desc(cake.basePrice)
        : sortBy === "name"
          ? asc(cake.name)
          : desc(cake.createdAt); // default: newest

  const rows = await db
    .select()
    .from(cake)
    .where(conditions)
    .orderBy(orderCol)
    .limit(limit)
    .offset(offset);

  return c.json({ success: true, ...paginate(rows, total, page, limit) });
});

// ─── GET /api/admin/cakes/:id ─────────────────────────────────────────────────

cakes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const full = await getCakeFull(id);
  if (!full) return c.json({ success: false, error: "Cake not found" }, 404);
  return c.json({ success: true, data: full });
});

// ─── POST /api/admin/cakes ────────────────────────────────────────────────────

cakes.post("/", validateBody(createCakeSchema), async (c) => {
  const input = c.get("validatedBody") as z.infer<typeof createCakeSchema>;

  try {
    const created = await createCake(input);
    const full = await getCakeFull(created!.id);
    return c.json({ success: true, data: full }, 201);
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to create cake" },
      (e.statusCode as 400 | 409 | 500) ?? 500,
    );
  }
});

// ─── PUT /api/admin/cakes/:id ─────────────────────────────────────────────────

cakes.put("/:id", validateBody(updateCakeSchema), async (c) => {
  const id = c.req.param("id");
  const input = c.get("validatedBody") as z.infer<typeof updateCakeSchema>;

  try {
    await updateCake(id, input);
    const full = await getCakeFull(id);
    return c.json({ success: true, data: full });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to update cake" },
      (e.statusCode as 404 | 500) ?? 500,
    );
  }
});

// ─── DELETE /api/admin/cakes/:id ──────────────────────────────────────────────
// Hard delete — permanently removes cake, images (Cloudinary + DB), variants,
// tags, reviews, and wishlist entries. Order items are nulled out (history kept).

cakes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    await hardDeleteCake(id);
    return c.json({ success: true, message: "Cake permanently deleted" });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to delete cake" },
      (e.statusCode as 404 | 500) ?? 500,
    );
  }
});

// ─── Images ───────────────────────────────────────────────────────────────────

// POST /api/admin/cakes/:id/images — attach an uploaded image to a cake
cakes.post("/:id/images", validateBody(attachImageSchema), async (c) => {
  const cakeId = c.req.param("id");
  const input = c.get("validatedBody") as z.infer<typeof attachImageSchema>;

  try {
    const image = await attachImageToCake(cakeId, input);
    return c.json({ success: true, data: image }, 201);
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to attach image" },
      (e.statusCode as 404 | 500) ?? 500,
    );
  }
});

// DELETE /api/admin/cakes/:id/images/:imageId
cakes.delete("/:id/images/:imageId", async (c) => {
  const cakeId = c.req.param("id");
  const imageId = c.req.param("imageId");

  try {
    await detachImageFromCake(cakeId, imageId);
    return c.json({ success: true, message: "Image removed" });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to remove image" },
      (e.statusCode as 404 | 500) ?? 500,
    );
  }
});

// PATCH /api/admin/cakes/:id/images/:imageId/primary — set as primary image
cakes.patch("/:id/images/:imageId/primary", async (c) => {
  const cakeId = c.req.param("id");
  const imageId = c.req.param("imageId");

  try {
    await setPrimaryImage(cakeId, imageId);
    return c.json({ success: true, message: "Primary image updated" });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to set primary image" },
      (e.statusCode as 404 | 500) ?? 500,
    );
  }
});

// ─── Variants ─────────────────────────────────────────────────────────────────

// POST /api/admin/cakes/:id/variants
cakes.post("/:id/variants", validateBody(variantSchema), async (c) => {
  const cakeId = c.req.param("id");
  const input = c.get("validatedBody") as z.infer<typeof variantSchema>;

  try {
    const variant = await addVariant(cakeId, input);
    return c.json({ success: true, data: variant }, 201);
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to add variant" },
      (e.statusCode as 404 | 500) ?? 500,
    );
  }
});

// PUT /api/admin/cakes/:id/variants/:variantId
cakes.put(
  "/:id/variants/:variantId",
  validateBody(updateVariantSchema),
  async (c) => {
    const cakeId = c.req.param("id");
    const variantId = c.req.param("variantId");
    const input = c.get("validatedBody") as z.infer<typeof updateVariantSchema>;

    try {
      const variant = await updateVariant(cakeId, variantId, input);
      return c.json({ success: true, data: variant });
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number };
      return c.json(
        { success: false, error: e.message ?? "Failed to update variant" },
        (e.statusCode as 404 | 500) ?? 500,
      );
    }
  },
);

// DELETE /api/admin/cakes/:id/variants/:variantId
cakes.delete("/:id/variants/:variantId", async (c) => {
  const cakeId = c.req.param("id");
  const variantId = c.req.param("variantId");

  try {
    await removeVariant(cakeId, variantId);
    return c.json({ success: true, message: "Variant removed" });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to remove variant" },
      (e.statusCode as 404 | 500) ?? 500,
    );
  }
});

export { cakes };
