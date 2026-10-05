import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/globalSetup.ts'],
    setupFiles: ['./test/setup.ts'],
    // Cac file test dung chung 1 DB (truncate giua moi test) -> chay tuan tu
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 20_000,
    include: ['test/**/*.test.ts'],
  },
});
