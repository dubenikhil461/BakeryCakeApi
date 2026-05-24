import { Hono } from "hono";
import type { HonoVariables } from "../../types/hono.ts";
import { requireAdmin } from "../../middleware/auth.middleware.ts";
import {
  uploadImage,
  deleteUploadById,
} from "../../services/upload.service.ts";

const uploads = new Hono<{ Variables: HonoVariables }>();

// All routes in this file require admin
uploads.use("/*", requireAdmin);

// ─── POST /api/admin/uploads ──────────────────────────────────────────────────
// Upload an image to Cloudinary. Returns { id, url, storageKey }.
// Body: multipart/form-data with field "file"

uploads.post("/", async (c) => {
  const user = c.get("user")!;

  let body: Record<string, File | string | File[] | string[]>;
  try {
    body = await c.req.parseBody();
  } catch {
    return c.json({ success: false, error: "Invalid multipart body" }, 400);
  }

  const file = body["file"];

  if (!file || !(file instanceof File)) {
    return c.json(
      { success: false, error: 'Missing file. Send multipart/form-data with field "file"' },
      400,
    );
  }

  try {
    const result = await uploadImage(file, user.id);
    return c.json({ success: true, data: result }, 201);
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Upload failed" },
      (e.statusCode as 400 | 500) ?? 500,
    );
  }
});

// ─── DELETE /api/admin/uploads/:id ───────────────────────────────────────────
// Delete an upload record and its Cloudinary asset.

uploads.delete("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    await deleteUploadById(id);
    return c.json({ success: true, message: "Upload deleted" });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Delete failed" },
      (e.statusCode as 404 | 500) ?? 500,
    );
  }
});

export { uploads };
