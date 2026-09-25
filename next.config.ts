import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build type-checks app code only; see tsconfig.build.json.
  typescript: {
    tsconfigPath: "tsconfig.build.json",
  },
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

export default nextConfig;
