import { Hono } from "hono";
import type { HonoVariables } from "../../types/hono.ts";
import { uploads } from "./uploads.admin.ts";
import { categories } from "./categories.admin.ts";
import { cakes } from "./cakes.admin.ts";

const adminRouter = new Hono<{ Variables: HonoVariables }>();

adminRouter.route("/uploads", uploads);
adminRouter.route("/categories", categories);
adminRouter.route("/cakes", cakes);

// Phases 6–8 will add: orders, reviews, users

export { adminRouter };
