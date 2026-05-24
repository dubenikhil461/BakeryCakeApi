import type { Context, Next } from "hono";
import { z, type ZodSchema } from "zod";
import type { HonoVariables } from "../types/hono.ts";

/**
 * Validate the JSON request body against a Zod schema.
 * On success, parsed data is available via c.get("validatedBody").
 * On failure, returns 422 with structured error details.
 *
 * Usage:
 *   router.post("/cakes", validateBody(createCakeSchema), handler)
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return async (c: Context<{ Variables: HonoVariables }>, next: Next) => {
    let body: unknown;

    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { success: false, error: "Invalid JSON body" },
        400,
      );
    }

    const result = schema.safeParse(body);

    if (!result.success) {
      return c.json(
        {
          success: false,
          error: "Validation failed",
          details: result.error.flatten().fieldErrors,
        },
        422,
      );
    }

    c.set("validatedBody", result.data);
    await next();
  };
}

/**
 * Validate query string params against a Zod schema.
 * On success, parsed data is available via c.get("validatedBody").
 *
 * Usage:
 *   router.get("/cakes", validateQuery(listCakesSchema), handler)
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return async (c: Context<{ Variables: HonoVariables }>, next: Next) => {
    const query = c.req.query();
    const result = schema.safeParse(query);

    if (!result.success) {
      return c.json(
        {
          success: false,
          error: "Invalid query parameters",
          details: result.error.flatten().fieldErrors,
        },
        422,
      );
    }

    c.set("validatedBody", result.data);
    await next();
  };
}

// ─── Re-export Zod for convenience ───────────────────────────────────────────
export { z };
