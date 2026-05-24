import type { Context, Next } from "hono";
import { auth } from "../lib/auth.ts";
import type { HonoVariables } from "../types/hono.ts";

/**
 * Requires a valid session.
 * Sets c.var.user and c.var.session on success.
 * Returns 401 if no session found.
 */
export async function requireAuth(
  c: Context<{ Variables: HonoVariables }>,
  next: Next,
) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  // Block banned users
  if (session.user.banned) {
    return c.json(
      {
        success: false,
        error: "Your account has been suspended.",
        reason: session.user.banReason ?? undefined,
      },
      403,
    );
  }

  c.set("user", session.user as HonoVariables["user"]);
  c.set("session", session.session);
  await next();
}

/**
 * Requires a valid session AND admin role.
 * Returns 401 if not logged in, 403 if not admin.
 */
export async function requireAdmin(
  c: Context<{ Variables: HonoVariables }>,
  next: Next,
) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  if (session.user.banned) {
    return c.json(
      { success: false, error: "Your account has been suspended." },
      403,
    );
  }

  if (session.user.role !== "admin") {
    return c.json({ success: false, error: "Forbidden: admin access required" }, 403);
  }

  c.set("user", session.user as HonoVariables["user"]);
  c.set("session", session.session);
  await next();
}

/**
 * Optional auth — always continues.
 * Sets user/session to null if not authenticated.
 * Use on public routes that have auth-aware behaviour (e.g. showing wishlist state).
 */
export async function optionalAuth(
  c: Context<{ Variables: HonoVariables }>,
  next: Next,
) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", (session?.user as HonoVariables["user"]) ?? null);
  c.set("session", session?.session ?? null);
  await next();
}
