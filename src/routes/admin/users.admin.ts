import { Hono } from "hono";
import { z } from "zod";
import type { HonoVariables } from "../../types/hono.ts";
import { requireAdmin } from "../../middleware/auth.middleware.ts";
import { validateBody } from "../../middleware/validate.middleware.ts";
import { auth } from "../../lib/auth.ts";

const usersAdmin = new Hono<{ Variables: HonoVariables }>();
usersAdmin.use("/*", requireAdmin);

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const setRoleSchema = z.object({
  role: z.enum(["user", "admin"]),
});

const banUserSchema = z.object({
  banReason: z.string().max(500).optional(),
  banExpiresIn: z.number().int().positive().optional(), // seconds until ban expires; omit for permanent
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
// List all users via better-auth admin API.
//
// Supports same query params as better-auth listUsers:
//   limit, offset, sortBy, sortDirection, searchField, searchValue

usersAdmin.get("/", async (c) => {
  try {
    const query = c.req.query();
    const response = await auth.api.listUsers({
      headers: c.req.raw.headers,
      query: {
        limit: query.limit ? Number(query.limit) : 20,
        offset: query.offset ? Number(query.offset) : 0,
        ...(query.sortBy ? { sortBy: query.sortBy as "email" | "createdAt" } : {}),
        ...(query.sortDirection
          ? { sortDirection: query.sortDirection as "asc" | "desc" }
          : {}),
        ...(query.searchField && query.searchValue
          ? {
              searchField: query.searchField as "email" | "name",
              searchValue: query.searchValue,
            }
          : {}),
      },
    });

    return c.json({ success: true, data: response });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to list users" },
      (e.statusCode as 500) ?? 500,
    );
  }
});

// ─── PATCH /api/admin/users/:id/role ─────────────────────────────────────────
// Promote or demote a user's role.

usersAdmin.patch(
  "/:id/role",
  validateBody(setRoleSchema),
  async (c) => {
    const userId = c.req.param("id");
    const { role } = c.get("validatedBody") as z.infer<typeof setRoleSchema>;

    try {
      const response = await auth.api.setRole({
        headers: c.req.raw.headers,
        body: { userId, role },
      });
      return c.json({ success: true, data: response });
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number };
      return c.json(
        { success: false, error: e.message ?? "Failed to set role" },
        (e.statusCode as 400 | 404 | 500) ?? 500,
      );
    }
  },
);

// ─── POST /api/admin/users/:id/ban ────────────────────────────────────────────
// Ban a user. Optionally include reason and expiry duration.

usersAdmin.post(
  "/:id/ban",
  validateBody(banUserSchema),
  async (c) => {
    const userId = c.req.param("id");
    const input = c.get("validatedBody") as z.infer<typeof banUserSchema>;

    try {
      const response = await auth.api.banUser({
        headers: c.req.raw.headers,
        body: {
          userId,
          ...(input.banReason ? { banReason: input.banReason } : {}),
          ...(input.banExpiresIn ? { banExpiresIn: input.banExpiresIn } : {}),
        },
      });
      return c.json({ success: true, data: response });
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number };
      return c.json(
        { success: false, error: e.message ?? "Failed to ban user" },
        (e.statusCode as 400 | 404 | 500) ?? 500,
      );
    }
  },
);

// ─── POST /api/admin/users/:id/unban ─────────────────────────────────────────
// Lift a ban from a user.

usersAdmin.post("/:id/unban", async (c) => {
  const userId = c.req.param("id");

  try {
    const response = await auth.api.unbanUser({
      headers: c.req.raw.headers,
      body: { userId },
    });
    return c.json({ success: true, data: response });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Failed to unban user" },
      (e.statusCode as 400 | 404 | 500) ?? 500,
    );
  }
});

export { usersAdmin };
