import type { NextConfig } from "next";

const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/files/:path*",
        destination: `${backendUrl}/api/files/:path*`,
      },
    ];
  },
};

export default nextConfig;
