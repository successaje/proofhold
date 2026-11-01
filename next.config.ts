import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security";

const config: NextConfig = {
  serverExternalPackages: ["node:sqlite", "pg"],
  poweredByHeader: false,
  devIndicators: false,
  turbopack: { root: process.cwd() },
  async headers() {
    const appUrl = process.env.APP_URL ?? "http://127.0.0.1:3200";
    const headers = securityHeaders(appUrl, process.env.NODE_ENV !== "production");
    return [
      {
        source: "/(.*)",
        headers: Object.entries(headers).map(([key, value]) => ({ key, value })),
      },
    ];
  },
};

export default config;
