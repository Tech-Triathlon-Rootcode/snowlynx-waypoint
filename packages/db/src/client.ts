import { drizzle } from "drizzle-orm/node-postgres";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { waypointPool?: Pool };
const dbPackageDir = dirname(fileURLToPath(import.meta.url));

// Local scripts and the Next.js workspace run from different package folders.
// Load the repository-level file only as a fallback; hosted environments keep
// using their injected DATABASE_URL.
if (!process.env.DATABASE_URL) {
  config({ path: resolve(dbPackageDir, "../../../.env"), quiet: true });
}

export function getPool(): Pool {
  if (!globalForDb.waypointPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required.");
    globalForDb.waypointPool = new Pool({
      connectionString,
      max: process.env.NODE_ENV === "production" ? 4 : 10,
      ssl: connectionString.includes("localhost") || connectionString.includes("postgres:5432") ? false : { rejectUnauthorized: false },
    });
  }
  return globalForDb.waypointPool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

export type WaypointDb = ReturnType<typeof getDb>;
