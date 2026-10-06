import type { NextConfig } from "next";

/**
 * Application-wide Next.js settings, consumed through this module's default export.
 * Adjust these when configuring web development, builds or production startup.
 */
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["pg"],
  /** Suppress proof-bearing referrers across every browser and callback route. */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};
export default config;
