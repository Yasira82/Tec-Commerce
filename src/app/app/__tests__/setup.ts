import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ✅ Fix React Fast Refresh in test env
(globalThis as any).$RefreshSig$ = () => (type: any) => type;
(globalThis as any).$RefreshReg$ = () => {};

// ✅ Cookie mock — configurable:true عشان كل test يقدر يعيد تعريفه
if (typeof document !== 'undefined') {
  Object.defineProperty(document, 'cookie', {
    writable:     true,
    configurable: true,
    value:        '',
  });
}

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter:       () => ({ push: vi.fn(), replace: vi.fn() }),
}));
