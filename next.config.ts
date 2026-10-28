import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["node:sqlite", "pg"],
  poweredByHeader: false,
  devIndicators: false,
  turbopack: { root: process.cwd() },
};

export default config;
