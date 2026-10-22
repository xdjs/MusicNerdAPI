import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // Build type-checks app code only; see tsconfig.build.json.
  typescript: {
    tsconfigPath: "tsconfig.build.json",
  },
  // pdf-parse is a Node-only CJS lib with dynamic requires; let it load at
  // runtime from node_modules instead of being bundled by Next.
  serverExternalPackages: ["pdf-parse"],
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS, PATCH" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, X-Requested-With, x-api-key",
          },
        ],
      },
    ];
  },
};

// The claim build runs as a durable workflow (lib/claimBuild).
export default withWorkflow(nextConfig);
