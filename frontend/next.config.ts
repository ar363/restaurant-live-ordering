import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained build in .next/standalone for the prod Docker image
  output: "standalone",
};

export default nextConfig;
