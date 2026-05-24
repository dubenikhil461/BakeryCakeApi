import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./lib/auth.ts";
import type { HonoVariables } from "./types/hono.ts";
import { adminRouter } from "./routes/admin/index.ts";
import { publicRouter } from "./routes/public/index.ts";
import packageJson from "../package.json";

const app = new Hono<{ Variables: HonoVariables }>();

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin) => {
      const allowed = [
        process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
        process.env.SITE_URL ?? "https://shirvargicake.in",
      ];
      return allowed.includes(origin) ? origin : allowed[0];
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// ─── Auth (better-auth handles all /api/auth/* routes) ────────────────────────
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (c) =>
  c.json({ status: "ok", version: packageJson.version }),
);

// ─── Admin Routes ─────────────────────────────────────────────────────────────
app.route("/api/admin", adminRouter);

// ─── Public Routes ────────────────────────────────────────────────────────────
app.route("/api", publicRouter);

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.onError((err, c) => {
  console.error(`[ERROR] ${c.req.method} ${c.req.url}`, err);
  return c.json(
    {
      success: false,
      error: "Internal Server Error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    },
    500,
  );
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.notFound((c) =>
  c.json(
    {
      success: false,
      error: "Not Found",
      path: c.req.path,
    },
    404,
  ),
);

// ─── Start ────────────────────────────────────────────────────────────────────
const port = Number(process.env.PORT) || 7021;
console.log(`🎂 Shivraga Cake API running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
