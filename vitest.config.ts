import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/offline-setup.ts'],
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
  },
});
