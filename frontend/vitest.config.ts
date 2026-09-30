import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Cau hinh rieng cho unit test (vitest dung ban vite cua no, khac vite 8 cua
// app, nen tach file de khong lam roi tsc cua `npm run build`).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
