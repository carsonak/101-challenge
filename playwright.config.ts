/** Browser regression configuration; require an explicitly isolated running stack. */
import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
/** Synthetic browser tests run serially without retries so failures remain visible. */
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  retries: 0,
  timeout: 45000,
  outputDir:
    process.env.QA_BROWSER_OUTPUT ??
    join(tmpdir(), "challenge-browser-results"),
  use: {
    baseURL: process.env.QA_BASE_URL ?? "http://127.0.0.1:3101",
    launchOptions: { executablePath: process.env.QA_CHROMIUM_EXECUTABLE },
    trace: "off",
    screenshot: "off",
  },
});
