import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Languages: request config (locale from the km_locale cookie) in src/i18n/request.ts
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        // Uploaded media (Cloudflare R2 public bucket)
        protocol: "https",
        hostname: "cdn.kaammilega.com",
      },
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
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

export default withNextIntl(nextConfig);
