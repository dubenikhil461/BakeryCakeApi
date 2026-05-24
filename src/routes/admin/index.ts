import { Hono } from "hono";
import type { HonoVariables } from "../../types/hono.ts";
import { uploads } from "./uploads.admin.ts";
import { categories } from "./categories.admin.ts";
import { cakes } from "./cakes.admin.ts";
import { ordersAdmin } from "./orders.admin.ts";

const adminRouter = new Hono<{ Variables: HonoVariables }>();

adminRouter.route("/uploads", uploads);
adminRouter.route("/categories", categories);
adminRouter.route("/cakes", cakes);
adminRouter.route("/orders", ordersAdmin);

// Phase 7–8 will add: reviews, users

export { adminRouter };
