import { Hono } from "hono";
import { and, asc, count, desc, eq } from "drizzle-orm";
import type { HonoVariables } from "../../types/hono.ts";
import { db } from "../../db/index.ts";
import { category, cake, cakeImage } from "../../db/schema/app-schema.ts";
import { parsePagination, paginate } from "../../lib/pagination.ts";

const categoriesPublic = new Hono<{ Variables: HonoVariables }>();

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryRow = typeof category.$inferSelect;

interface CategoryTree extends CategoryRow {
  children: CategoryTree[];
}

/** Build a nested tree from a flat category array. */
function buildTree(rows: CategoryRow[]): CategoryTree[] {
  const map = new Map<string, CategoryTree>();
  const roots: CategoryTree[] = [];

  // First pass: create all nodes
  for (const row of rows) {
    map.set(row.id, { ...row, children: [] });
  }

  // Second pass: attach children to parents
  for (const row of rows) {
    const node = map.get(row.id)!;
    if (row.parentId && map.has(row.parentId)) {
      map.get(row.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ─── GET /api/categories ──────────────────────────────────────────────────────
// List all active categories.
// ?tree=true  → returns nested hierarchy instead of flat list

categoriesPublic.get("/", async (c) => {
  const tree = c.req.query("tree") === "true";

  const rows = await db
    .select()
    .from(category)
    .where(eq(category.isActive, true))
    .orderBy(asc(category.sortOrder), asc(category.name));

  if (tree) {
    return c.json({ success: true, data: buildTree(rows) });
  }

  return c.json({ success: true, data: rows });
});

// ─── GET /api/categories/:slug ────────────────────────────────────────────────
// Single category with its paginated active cakes and their primary images.

categoriesPublic.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const { page, limit, offset } = parsePagination(c.req.query());

  // Fetch category
  const [catRow] = await db
    .select()
    .from(category)
    .where(and(eq(category.slug, slug), eq(category.isActive, true)))
    .limit(1);

  if (!catRow) {
    return c.json({ success: false, error: "Category not found" }, 404);
  }

  // Count cakes in this category
  const [{ total }] = await db
    .select({ total: count() })
    .from(cake)
    .where(and(eq(cake.categoryId, catRow.id), eq(cake.isActive, true)));

  // Fetch paginated cakes
  const cakeRows = await db
    .select()
    .from(cake)
    .where(and(eq(cake.categoryId, catRow.id), eq(cake.isActive, true)))
    .orderBy(desc(cake.createdAt))
    .limit(limit)
    .offset(offset);

  // Batch fetch primary images for these cakes
  let cakesWithImages: Array<(typeof cakeRows)[number] & { primaryImage: { url: string; altText: string | null } | null }> = [];

  if (cakeRows.length > 0) {
    const { inArray } = await import("drizzle-orm");
    const cakeIds = cakeRows.map((c) => c.id);

    const primaryImages = await db
      .select({
        cakeId: cakeImage.cakeId,
        url: cakeImage.url,
        altText: cakeImage.altText,
      })
      .from(cakeImage)
      .where(and(inArray(cakeImage.cakeId, cakeIds), eq(cakeImage.isPrimary, true)));

    const imageMap = new Map(primaryImages.map((img) => [img.cakeId, img]));

    cakesWithImages = cakeRows.map((c) => ({
      ...c,
      primaryImage: imageMap.get(c.id) ?? null,
    }));
  }

  // Fetch subcategories
  const subcategories = await db
    .select()
    .from(category)
    .where(and(eq(category.parentId, catRow.id), eq(category.isActive, true)))
    .orderBy(asc(category.sortOrder));

  return c.json({
    success: true,
    data: {
      ...catRow,
      subcategories,
      cakes: paginate(cakesWithImages, total, page, limit),
    },
  });
});

export { categoriesPublic };
