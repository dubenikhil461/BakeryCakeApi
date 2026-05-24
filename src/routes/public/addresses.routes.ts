import { Hono } from "hono";
import { z } from "zod";
import type { HonoVariables } from "../../types/hono.ts";
import { requireAuth } from "../../middleware/auth.middleware.ts";
import { validateBody } from "../../middleware/validate.middleware.ts";
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "../../services/address.service.ts";

const addresses = new Hono<{ Variables: HonoVariables }>();
addresses.use("/*", requireAuth);

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const addressSchema = z.object({
  label: z.string().max(80).optional(),
  addressType: z.enum(["home", "office", "other"]).optional(),
  fullName: z.string().min(1).max(255),
  phone: z
    .string()
    .min(10)
    .max(20)
    .regex(/^[+\d\s-]+$/, "Invalid phone number"),
  line1: z.string().min(1).max(255),
  line2: z.string().max(255).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  pincode: z
    .string()
    .min(4)
    .max(10)
    .regex(/^\d+$/, "Pincode must be numeric"),
  country: z.string().max(60).optional(),
  isDefault: z.boolean().optional(),
});

const updateAddressSchema = addressSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" },
);

// ─── GET /api/addresses ───────────────────────────────────────────────────────

addresses.get("/", async (c) => {
  const user = c.get("user")!;
  const data = await getAddresses(user.id);
  return c.json({ success: true, data });
});

// ─── POST /api/addresses ──────────────────────────────────────────────────────

addresses.post("/", validateBody(addressSchema), async (c) => {
  const user = c.get("user")!;
  const input = c.get("validatedBody") as z.infer<typeof addressSchema>;

  const created = await createAddress(user.id, input);
  return c.json({ success: true, data: created }, 201);
});

// ─── PUT /api/addresses/:id ───────────────────────────────────────────────────

addresses.put("/:id", validateBody(updateAddressSchema), async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const input = c.get("validatedBody") as z.infer<typeof updateAddressSchema>;

  try {
    const updated = await updateAddress(user.id, id, input);
    return c.json({ success: true, data: updated });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to update address" },
      (e.statusCode as 404 | 500) ?? 500,
    );
  }
});

// ─── DELETE /api/addresses/:id ────────────────────────────────────────────────

addresses.delete("/:id", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  try {
    await deleteAddress(user.id, id);
    return c.json({ success: true, message: "Address deleted" });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to delete address" },
      (e.statusCode as 404 | 500) ?? 500,
    );
  }
});

// ─── PATCH /api/addresses/:id/default ────────────────────────────────────────

addresses.patch("/:id/default", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  try {
    const updated = await setDefaultAddress(user.id, id);
    return c.json({ success: true, data: updated });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to set default address" },
      (e.statusCode as 404 | 500) ?? 500,
    );
  }
});

export { addresses };
