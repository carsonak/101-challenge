import type { NextConfig } from "next";

/**
 * Application-wide Next.js settings, consumed through this module's default export.
 * Adjust these when configuring web development, builds or production startup.
 */
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["pg"],
};
export default config;
