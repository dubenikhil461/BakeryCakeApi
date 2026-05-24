import { Hono } from "hono";
import type { HonoVariables } from "../../types/hono.ts";
import { uploads } from "./uploads.admin.ts";
import { categories } from "./categories.admin.ts";
import { cakes } from "./cakes.admin.ts";
import { ordersAdmin } from "./orders.admin.ts";
import { reviewsAdmin } from "./reviews.admin.ts";
import { usersAdmin } from "./users.admin.ts";

const adminRouter = new Hono<{ Variables: HonoVariables }>();

adminRouter.route("/uploads", uploads);
adminRouter.route("/categories", categories);
adminRouter.route("/cakes", cakes);
adminRouter.route("/orders", ordersAdmin);
adminRouter.route("/reviews", reviewsAdmin);
adminRouter.route("/users", usersAdmin);

export { adminRouter };
