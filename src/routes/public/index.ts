import { Hono } from "hono";
import type { HonoVariables } from "../../types/hono.ts";
import { cakesPublic } from "./cakes.routes.ts";
import { categoriesPublic } from "./categories.routes.ts";

const publicRouter = new Hono<{ Variables: HonoVariables }>();

publicRouter.route("/cakes", cakesPublic);
publicRouter.route("/categories", categoriesPublic);

// Phases 5–7 will add: cart, orders, addresses, reviews, wishlist

export { publicRouter };
