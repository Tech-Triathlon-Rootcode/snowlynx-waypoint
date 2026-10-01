import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://waypoint:waypoint@localhost:5432/waypoint",
  },
  strict: true,
  verbose: true,
});
