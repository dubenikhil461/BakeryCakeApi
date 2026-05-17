import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema/auth-schema.ts";

const poolConnection = mysql.createPool({
  host: process.env.DATABASE_HOST ?? "localhost",
  user: process.env.DATABASE_USER ?? "root",
  port: Number(process.env.DATABASE_PORT) || 3306,
  password: process.env.DATABASE_PASSWORD ?? "",
  database: process.env.DATABASE_NAME ?? "shivragicakeapi",
});

export const db = drizzle({
  client: poolConnection,
  schema,
  mode: "default",
  logger: process.env.NODE_ENV === "development",
});