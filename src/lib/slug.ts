/**
 * Convert any string into a URL-safe slug.
 * e.g. "Chocolate Truffle Cake!!" → "chocolate-truffle-cake"
 */
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")   // remove special chars except hyphens
    .replace(/[\s_]+/g, "-")    // spaces and underscores → hyphens
    .replace(/-+/g, "-")        // collapse multiple hyphens
    .replace(/^-+|-+$/g, "");   // strip leading/trailing hyphens
}

/**
 * Make a slug unique by appending a short random suffix.
 * e.g. "chocolate-cake" → "chocolate-cake-a3f9"
 */
export function uniqueSlug(base: string): string {
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${toSlug(base)}-${suffix}`;
}
