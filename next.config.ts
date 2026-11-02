import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.CMS_E2E === "true" ? ".next-e2e" : ".next",
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
