import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    video: "on",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        channel: process.env.PLAYWRIGHT_CHANNEL,
      },
    },
  ],
  webServer: [
    {
      command: "go run ./services/api/cmd/server",
      url: "http://127.0.0.1:8181/api/health",
      env: {
        STORE_MODE: "memory",
        APP_ENV: "test",
        API_ADDR: "127.0.0.1:8181",
        PUBLIC_ORIGIN: "http://127.0.0.1:3100",
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command:
        "npx --yes pnpm@10.28.2 --dir apps/web dev --port 3100 --hostname 127.0.0.1",
      url: "http://127.0.0.1:3100",
      env: { API_ORIGIN: "http://127.0.0.1:8181" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
