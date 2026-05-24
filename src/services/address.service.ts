import { and, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { address } from "../db/schema/app-schema.ts";
import { newId } from "../lib/id.ts";

export interface AddressInput {
  label?: string;
  addressType?: "home" | "office" | "other";
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  isDefault?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Unset all default addresses for a user before setting a new one. */
async function clearDefaults(userId: string) {
  await db
    .update(address)
    .set({ isDefault: false })
    .where(and(eq(address.userId, userId), eq(address.isDefault, true)));
}

/** Verify an address belongs to the given user. */
async function assertOwnership(addressId: string, userId: string) {
  const [row] = await db
    .select({ id: address.id })
    .from(address)
    .where(and(eq(address.id, addressId), eq(address.userId, userId)))
    .limit(1);

  if (!row) {
    throw Object.assign(new Error("Address not found"), { statusCode: 404 });
  }
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function getAddresses(userId: string) {
  return db
    .select()
    .from(address)
    .where(eq(address.userId, userId))
    .orderBy(address.isDefault, address.createdAt);
}

export async function createAddress(userId: string, input: AddressInput) {
  // Count existing addresses — if this is the first, auto-set as default
  const existing = await db
    .select({ id: address.id })
    .from(address)
    .where(eq(address.userId, userId))
    .limit(1);

  const isFirst = existing.length === 0;
  const shouldBeDefault = input.isDefault ?? isFirst;

  if (shouldBeDefault) {
    await clearDefaults(userId);
  }

  const id = newId();
  await db.insert(address).values({
    id,
    userId,
    label: input.label,
    addressType: input.addressType ?? "home",
    fullName: input.fullName,
    phone: input.phone,
    line1: input.line1,
    line2: input.line2,
    city: input.city,
    state: input.state,
    pincode: input.pincode,
    country: input.country ?? "India",
    isDefault: shouldBeDefault,
  });

  const [created] = await db
    .select()
    .from(address)
    .where(eq(address.id, id))
    .limit(1);

  return created;
}

export async function updateAddress(
  userId: string,
  addressId: string,
  input: Partial<AddressInput>,
) {
  await assertOwnership(addressId, userId);

  if (input.isDefault === true) {
    await clearDefaults(userId);
  }

  await db
    .update(address)
    .set({
      ...(input.label !== undefined && { label: input.label }),
      ...(input.addressType !== undefined && { addressType: input.addressType }),
      ...(input.fullName !== undefined && { fullName: input.fullName }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.line1 !== undefined && { line1: input.line1 }),
      ...(input.line2 !== undefined && { line2: input.line2 }),
      ...(input.city !== undefined && { city: input.city }),
      ...(input.state !== undefined && { state: input.state }),
      ...(input.pincode !== undefined && { pincode: input.pincode }),
      ...(input.country !== undefined && { country: input.country }),
      ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
    })
    .where(eq(address.id, addressId));

  const [updated] = await db
    .select()
    .from(address)
    .where(eq(address.id, addressId))
    .limit(1);

  return updated;
}

export async function deleteAddress(userId: string, addressId: string) {
  await assertOwnership(addressId, userId);
  await db.delete(address).where(eq(address.id, addressId));
}

export async function setDefaultAddress(userId: string, addressId: string) {
  await assertOwnership(addressId, userId);
  await clearDefaults(userId);
  await db
    .update(address)
    .set({ isDefault: true })
    .where(eq(address.id, addressId));

  const [updated] = await db
    .select()
    .from(address)
    .where(eq(address.id, addressId))
    .limit(1);

  return updated;
}
