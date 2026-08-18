import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["dietitian-ai-assistant-architecture"],
  typescript: {
    tsconfigPath: "tsconfig.production.json",
  },
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
