import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["dietitian-ai-assistant-architecture"],
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
