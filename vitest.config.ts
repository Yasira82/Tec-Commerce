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
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
