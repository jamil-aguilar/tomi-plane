import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Los PDF viajan por un Server Action; el tope por defecto es 1 MB.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
