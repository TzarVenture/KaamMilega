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
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/candidate/applications",
        destination: "/applications",
        permanent: true,
      },
      {
        source: "/candidate/application",
        destination: "/applications",
        permanent: true,
      },
      {
        source: "/candidate/interviews",
        destination: "/interviews",
        permanent: true,
      },
      {
        source: "/candidate/interview",
        destination: "/interviews",
        permanent: true,
      },
      {
        source: "/candidate/profile",
        destination: "/profile",
        permanent: true,
      },
    ];
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
