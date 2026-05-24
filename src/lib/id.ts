/**
 * Generate a new UUID v4.
 * Used for all primary keys in the database (consistent with auth-schema PKs).
 */
export const newId = (): string => crypto.randomUUID();
