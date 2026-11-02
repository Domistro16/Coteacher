import { defineConfig } from '@playwright/test';
export default defineConfig({
  globalSetup: './tests/e2e/privacy-servers.ts', testDir: './tests/e2e', testMatch: 'privacy-*.spec.ts',
  fullyParallel: false, workers: 1, retries: 0, reporter: 'list',
  use: { baseURL: 'http://localhost:4273', browserName: 'chromium', viewport: {width:1366,height:900},
    serviceWorkers:'allow', trace:'retain-on-failure', screenshot:'only-on-failure' },
});
