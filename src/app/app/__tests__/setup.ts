import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ✅ Fix React Fast Refresh in test env
(globalThis as any).$RefreshSig$ = () => (type: any) => type;
(globalThis as any).$RefreshReg$ = () => {};

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter:       () => ({ push: vi.fn(), replace: vi.fn() }),
}));
