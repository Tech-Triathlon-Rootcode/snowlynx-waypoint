import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import { getDb, getPool } from "./client";

await migrate(getDb(), { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
await getPool().end();
console.log("Database migrations completed.");
