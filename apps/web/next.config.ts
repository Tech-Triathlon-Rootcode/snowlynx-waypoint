import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd(), "../..");
loadEnvConfig(repositoryRoot);

const nextConfig: NextConfig = {
  agentRules: false,
  output: "standalone",
  transpilePackages: ["@snowlynx/domain", "@snowlynx/db"],
  outputFileTracingRoot: repositoryRoot,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
