import { Hono } from "hono";
import type { HonoVariables } from "../../types/hono.ts";
import { cakesPublic } from "./cakes.routes.ts";
import { categoriesPublic } from "./categories.routes.ts";
import { addresses } from "./addresses.routes.ts";
import { cartRoutes } from "./cart.routes.ts";
import { ordersPublic } from "./orders.routes.ts";

const publicRouter = new Hono<{ Variables: HonoVariables }>();

// Public (no auth)
publicRouter.route("/cakes", cakesPublic);
publicRouter.route("/categories", categoriesPublic);

// Customer (requireAuth applied inside each router)
publicRouter.route("/addresses", addresses);
publicRouter.route("/cart", cartRoutes);
publicRouter.route("/orders", ordersPublic);

// Phase 7 will add: reviews, wishlist

export { publicRouter };
