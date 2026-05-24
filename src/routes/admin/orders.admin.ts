import { Hono } from "hono";
import { z } from "zod";
import type { HonoVariables } from "../../types/hono.ts";
import { requireAdmin } from "../../middleware/auth.middleware.ts";
import { validateBody } from "../../middleware/validate.middleware.ts";
import {
  adminGetOrders,
  adminGetOrderByNumber,
  adminUpdateOrderStatus,
  adminUpdateNote,
} from "../../services/order.service.ts";

const ordersAdmin = new Hono<{ Variables: HonoVariables }>();
ordersAdmin.use("/*", requireAdmin);

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const updateStatusSchema = z.object({
  status: z.enum([
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "refunded",
  ]),
  note: z.string().max(1000).optional(),
});

const updateNoteSchema = z.object({
  adminNote: z.string().max(2000),
});

// ─── GET /api/admin/orders ────────────────────────────────────────────────────
// List all orders with optional filters.
//
// Query params:
//   status        — order status enum value
//   paymentStatus — payment status enum value
//   userId        — filter by specific user
//   from          — ISO date string (createdAt >=)
//   to            — ISO date string (createdAt <=)
//   page, limit

ordersAdmin.get("/", async (c) => {
  const result = await adminGetOrders(c.req.query());
  return c.json({ success: true, ...result });
});

// ─── GET /api/admin/orders/:orderNumber ───────────────────────────────────────

ordersAdmin.get("/:orderNumber", async (c) => {
  const orderNumber = c.req.param("orderNumber");

  try {
    const data = await adminGetOrderByNumber(orderNumber);
    return c.json({ success: true, data });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    return c.json(
      { success: false, error: e.message ?? "Order not found" },
      (e.statusCode as 404 | 500) ?? 500,
    );
  }
});

// ─── PATCH /api/admin/orders/:orderNumber/status ──────────────────────────────
// Update order status + append a status history entry.

ordersAdmin.patch(
  "/:orderNumber/status",
  validateBody(updateStatusSchema),
  async (c) => {
    const user = c.get("user")!;
    const orderNumber = c.req.param("orderNumber");
    const input = c.get("validatedBody") as z.infer<typeof updateStatusSchema>;

    try {
      const data = await adminUpdateOrderStatus(
        orderNumber,
        input.status,
        input.note,
        user.id,
      );
      return c.json({ success: true, data });
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number };
      return c.json(
        { success: false, error: e.message ?? "Failed to update status" },
        (e.statusCode as 404 | 500) ?? 500,
      );
    }
  },
);

// ─── PATCH /api/admin/orders/:orderNumber/note ────────────────────────────────
// Set or update the internal admin note on an order.

ordersAdmin.patch(
  "/:orderNumber/note",
  validateBody(updateNoteSchema),
  async (c) => {
    const orderNumber = c.req.param("orderNumber");
    const { adminNote } = c.get("validatedBody") as z.infer<typeof updateNoteSchema>;

    try {
      await adminUpdateNote(orderNumber, adminNote);
      return c.json({ success: true, message: "Note updated" });
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number };
      return c.json(
        { success: false, error: e.message ?? "Failed to update note" },
        (e.statusCode as 404 | 500) ?? 500,
      );
    }
  },
);

export { ordersAdmin };
