import { defineConfig } from '@playwright/test';

export default defineConfig({
  globalSetup: './tests/e2e/servers.ts',
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4273', browserName: 'chromium',
    viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true,
    serviceWorkers: 'allow', trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
});
