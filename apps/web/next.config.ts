import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async headers() {
    return [
      {
        // Hashed JS/CSS bundles — safe to cache forever in prod (immutable).
        // In dev, file names are NOT content-hashed, so skip caching entirely.
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: isDev
              ? "no-store"
              : "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Public folder assets (SVG, images, fonts) — no content hash, use 1-day TTL
        source: "/:path*.:ext(svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)",
        headers: [
          {
            key: "Cache-Control",
            value: isDev
              ? "no-store"
              : "public, max-age=86400, stale-while-revalidate=3600",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
