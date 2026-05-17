import { Hono } from "hono";
import { auth } from "./lib/auth";
import { cors } from "hono/cors";
import packageJson from "../package.json";

const app = new Hono();
app.use(cors(
    {
        origin: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    }
));
app.on(["POST", "GET"], "/api/auth/*", (c) => {
    return auth.handler(c.req.raw);
});

app.get("/health", (c) => {
    return c.json({ version: packageJson.version });
});

const port = Number(process.env.PORT) || 7021;

console.log(`Auth API listening on http://localhost:${port}/api/auth`);

export default {
    port,
    fetch: app.fetch,
};
