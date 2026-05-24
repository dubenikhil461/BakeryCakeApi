import { eq } from "drizzle-orm";
import { cloudinary } from "../lib/cloudinary.ts";
import { db } from "../db/index.ts";
import { upload } from "../db/schema/app-schema.ts";
import { newId } from "../lib/id.ts";

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface UploadResult {
  id: string;
  url: string;
  storageKey: string;
  width?: number;
  height?: number;
}

/**
 * Upload an image file to Cloudinary and record it in the `upload` table.
 * Validates mime type and file size before uploading.
 */
export async function uploadImage(
  file: File,
  uploadedBy: string,
): Promise<UploadResult> {
  if (!ALLOWED_MIMES.includes(file.type as (typeof ALLOWED_MIMES)[number])) {
    throw Object.assign(new Error("Invalid file type. Allowed: jpeg, png, webp"), {
      statusCode: 400,
    });
  }

  if (file.size > MAX_SIZE_BYTES) {
    throw Object.assign(new Error("File too large. Maximum size is 5 MB"), {
      statusCode: 400,
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Upload to Cloudinary — auto convert to webp for optimal delivery
  const result = await new Promise<{
    public_id: string;
    secure_url: string;
    width: number;
    height: number;
    bytes: number;
  }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "shivraga-cakes",
          resource_type: "image",
          format: "webp",
          quality: "auto",
          fetch_format: "auto",
        },
        (err, result) => {
          if (err || !result) reject(err ?? new Error("Cloudinary upload failed"));
          else resolve(result as typeof result & { public_id: string; secure_url: string });
        },
      )
      .end(buffer);
  });

  const id = newId();

  await db.insert(upload).values({
    id,
    uploadedBy,
    storageKey: result.public_id,
    publicUrl: result.secure_url,
    originalFilename: file.name,
    mimeType: file.type,
    sizeBytes: result.bytes,
    status: "completed",
  });

  return {
    id,
    url: result.secure_url,
    storageKey: result.public_id,
    width: result.width,
    height: result.height,
  };
}

/**
 * Delete an upload record and its asset from Cloudinary.
 */
export async function deleteUploadById(uploadId: string): Promise<void> {
  const [record] = await db
    .select()
    .from(upload)
    .where(eq(upload.id, uploadId))
    .limit(1);

  if (!record) {
    throw Object.assign(new Error("Upload not found"), { statusCode: 404 });
  }

  await cloudinary.uploader.destroy(record.storageKey);
  await db.delete(upload).where(eq(upload.id, uploadId));
}

/**
 * Link an upload record to a specific entity (e.g. a cake).
 * Called after attaching an upload to a cake_image.
 */
export async function linkUploadToEntity(
  storageKey: string,
  entityType: string,
  entityId: string,
): Promise<void> {
  await db
    .update(upload)
    .set({ linkedEntityType: entityType, linkedEntityId: entityId })
    .where(eq(upload.storageKey, storageKey));
}
