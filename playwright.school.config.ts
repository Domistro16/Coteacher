import { defineConfig } from "@playwright/test";
// School browser acceptance explicitly uses synthetic input and a mock tutor, never a paid live provider.
process.env.COTEACHER_TEST_TUTOR = "mock";
export default defineConfig({
  globalSetup: "./tests/e2e/servers.ts",
  testDir: "./tests/e2e",
  testMatch: "school-*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4275",
    browserName: "chromium",
    viewport: { width: 1366, height: 900 },
    serviceWorkers: "allow",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
