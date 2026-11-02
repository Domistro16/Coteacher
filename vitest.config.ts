import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Unit acceptance must not load private project env files.
  envDir: false,
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/offline-setup.ts'],
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
  },
});
