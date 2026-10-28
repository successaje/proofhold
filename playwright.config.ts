import { defineConfig, devices } from "@playwright/test";

/**
 * Browser flows A (service), B (goods) and C (objection, offer, void) against
 * a running app. Start it with `npm run local` (simulated PayPal) or point
 * PLAYWRIGHT_BASE_URL at a sandbox deployment. These runs are also the demo.
 */
export default defineConfig({
  testDir: "tests/browser",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3200",
    trace: "retain-on-failure",
    video: process.env.PLAYWRIGHT_VIDEO ? "on" : "off",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 800 },
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run local",
        url: "http://127.0.0.1:3200/api/health",
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          PORT: "3200",
          APP_URL: "http://127.0.0.1:3200",
          APP_SECRET: "playwright-secret-not-for-production",
          PAYPAL_MODE: process.env.PAYPAL_MODE ?? "simulated",
          DEMO_SILENCE_MINUTES: "1",
          PROOFHOLD_DATA_DIR: process.env.PROOFHOLD_DATA_DIR ?? ".data/playwright",
        },
      },
});
