import type { NextConfig } from "next";

/**
 * Application-wide Next.js settings, consumed through this module's default export.
 * Adjust these when configuring web development, builds or production startup.
 */
const config: NextConfig = {
  poweredByHeader: false,
  experimental: { cpus: 2 },
  output: "standalone",
  serverExternalPackages: ["pg"],
  /** Suppress proof-bearing referrers across every browser and callback route. */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...(process.env.APP_ORIGIN?.startsWith("https:")
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
            : []),
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default config;
