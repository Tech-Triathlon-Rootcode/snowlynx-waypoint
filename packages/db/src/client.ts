import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { waypointPool?: Pool };

// NOTE: Do not load dotenv here. This module is bundled by Next.js/Turbopack
// (see apps/web/next.config.ts which already loads the repo-root .env via
// loadEnvConfig). A static `new URL(".../.env", import.meta.url)` pattern makes
// Turbopack try to bundle the .env file at build time and fails in CI where
// .env is gitignored. CLI entrypoints (migrate.ts / seed.ts) load dotenv
// explicitly instead; hosted environments use the injected DATABASE_URL.

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
