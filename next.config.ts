import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://asab-design.ro https://*.asab-design.ro",
          },
        ],
      },
    ];
  },
  transpilePackages: ["three"],
};

export default nextConfig;
