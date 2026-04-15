import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {},
  webpack: (config) => {
    // Handle canvas dependency from react-pdf
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
