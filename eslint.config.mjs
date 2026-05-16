// @ts-check
import { FlatCompat } from '@eslint/eslintrc';
import path           from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'e2e/**',
      '**/__tests__/**',
      '*.config.*',
    ],
  },
  ...compat.extends('next/core-web-vitals'),
];
