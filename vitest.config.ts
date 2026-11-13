import { defineConfig } from 'vitest/config';
import react             from '@vitejs/plugin-react';
import * as path         from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    include:     ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude:     ['node_modules', 'e2e', '.next'],
    globals:     true,
    setupFiles:  ['src/app/app/__tests__/setup.ts'],
    // TEC-AUDIT-0037 — a RATCHET below the fleet's 60/60/60/50. Measured 13 Nov 2026 over EVERY
    // file in src/ (an untested file counts as 0, not as absent): 53.96 statements · 48.01 branches · 46.28 functions · 56.83 lines.
    // Set at what it passes today so it can only go up; raise each number as tests are added.
    coverage: {
      provider:   'v8',
      reporter:   ['text', 'json-summary'],
      include:    ['src/**/*.{ts,tsx}'],
      exclude:    ['**/*.test.*', '**/*.spec.*', '**/__tests__/**', 'e2e/**'],
      thresholds: { lines: 56, functions: 46, statements: 53, branches: 48 },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
