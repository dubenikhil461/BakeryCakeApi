import Razorpay from "razorpay";

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

/**
 * Generate a human-readable order number.
 * Format: ORD-YYYYMMDD-XXXXXX  (e.g. ORD-20260524-A7X2K9)
 */
export function generateOrderNumber(): string {
  const date = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  const suffix = Math.random().toString(36).toUpperCase().slice(2, 8);
  return `ORD-${date}-${suffix}`;
}
