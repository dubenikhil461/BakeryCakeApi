import Razorpay from "razorpay";

// Lazily initialised so the server can start without Razorpay credentials
// (e.g. during development when only COD is used).
let _razorpay: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!_razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error(
        "Razorpay credentials not set. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env",
      );
    }
    _razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpay;
}

// Keep named export for backward compat — alias of getRazorpay()
export const razorpay = { get orders() { return getRazorpay().orders; } };

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
