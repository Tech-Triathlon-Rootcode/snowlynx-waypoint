import { config } from "dotenv";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb, getPool } from "./client";

// Local CLI only (never bundled by Next.js): load .env from the package dir
// first, then fall back to the repository root. Uses process.cwd() instead of
// `new URL(..., import.meta.url)` so bundlers never try to resolve it.
if (!process.env.DATABASE_URL) {
  config({ path: join(process.cwd(), ".env"), quiet: true });
  config({ path: join(process.cwd(), "../../.env"), quiet: true });
}

await migrate(getDb(), { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
await getPool().end();
console.log("Database migrations completed.");
