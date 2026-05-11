import { defineConfig } from 'vitest/config';
import path             from 'path';

export default defineConfig({
  test: {
    environment:    'happy-dom',
    include:        ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude:        ['node_modules', 'e2e', '.next'],
    globals:        true,
    setupFiles:     ['src/app/app/__tests__/setup.ts'],
    transformMode:  { web: [/\.[jt]sx$/] },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
