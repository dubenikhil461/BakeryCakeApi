import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { HonoVariables } from "../../types/hono.ts";
import { requireAdmin } from "../../middleware/auth.middleware.ts";
import { validateBody } from "../../middleware/validate.middleware.ts";
import { db } from "../../db/index.ts";
import { category, cake } from "../../db/schema/app-schema.ts";
import { newId } from "../../lib/id.ts";
import { toSlug, uniqueSlug } from "../../lib/slug.ts";

const categories = new Hono<{ Variables: HonoVariables }>();
categories.use("/*", requireAdmin);

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  parentId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const updateCategorySchema = createCategorySchema.partial();

// ─── GET /api/admin/categories ────────────────────────────────────────────────
// List all categories including inactive ones.

categories.get("/", async (c) => {
  const rows = await db
    .select()
    .from(category)
    .orderBy(category.sortOrder, category.name);

  return c.json({ success: true, data: rows });
});

// ─── GET /api/admin/categories/:id ───────────────────────────────────────────

categories.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [row] = await db
    .select()
    .from(category)
    .where(eq(category.id, id))
    .limit(1);

  if (!row) return c.json({ success: false, error: "Category not found" }, 404);
  return c.json({ success: true, data: row });
});

// ─── POST /api/admin/categories ──────────────────────────────────────────────

categories.post("/", validateBody(createCategorySchema), async (c) => {
  const input = c.get("validatedBody") as z.infer<typeof createCategorySchema>;

  // generate unique slug
  const baseSlug = toSlug(input.name);
  const [existing] = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.slug, baseSlug))
    .limit(1);

  const slug = existing ? uniqueSlug(input.name) : baseSlug;
  const id = newId();

  await db.insert(category).values({
    id,
    name: input.name,
    slug,
    description: input.description,
    imageUrl: input.imageUrl,
    parentId: input.parentId ?? undefined,
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
  });

  const [created] = await db
    .select()
    .from(category)
    .where(eq(category.id, id))
    .limit(1);

  return c.json({ success: true, data: created }, 201);
});

// ─── PUT /api/admin/categories/:id ───────────────────────────────────────────

categories.put("/:id", validateBody(updateCategorySchema), async (c) => {
  const id = c.req.param("id");
  const input = c.get("validatedBody") as z.infer<typeof updateCategorySchema>;

  const [existing] = await db
    .select()
    .from(category)
    .where(eq(category.id, id))
    .limit(1);

  if (!existing) {
    return c.json({ success: false, error: "Category not found" }, 404);
  }

  // regenerate slug only if name changed
  let slug = existing.slug;
  if (input.name && input.name !== existing.name) {
    const baseSlug = toSlug(input.name);
    const [conflict] = await db
      .select({ id: category.id })
      .from(category)
      .where(eq(category.slug, baseSlug))
      .limit(1);
    slug = conflict && conflict.id !== id ? uniqueSlug(input.name) : baseSlug;
  }

  await db
    .update(category)
    .set({
      ...(input.name && { name: input.name, slug }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
      ...(input.parentId !== undefined && { parentId: input.parentId ?? undefined }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    })
    .where(eq(category.id, id));

  const [updated] = await db
    .select()
    .from(category)
    .where(eq(category.id, id))
    .limit(1);

  return c.json({ success: true, data: updated });
});

// ─── DELETE /api/admin/categories/:id ────────────────────────────────────────

categories.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const [existing] = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.id, id))
    .limit(1);

  if (!existing) {
    return c.json({ success: false, error: "Category not found" }, 404);
  }

  // check if any cakes reference this category
  const [inUse] = await db
    .select({ id: cake.id })
    .from(cake)
    .where(eq(cake.categoryId, id))
    .limit(1);

  if (inUse) {
    return c.json(
      {
        success: false,
        error: "Cannot delete: category is in use by one or more cakes",
      },
      409,
    );
  }

  await db.delete(category).where(eq(category.id, id));
  return c.json({ success: true, message: "Category deleted" });
});

export { categories };
