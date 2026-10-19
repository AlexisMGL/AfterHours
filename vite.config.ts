import { defineConfig } from 'vitest/config';
export default defineConfig({
  base: '/',
  build: { target: 'es2022', rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } } },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 60000 },
});

