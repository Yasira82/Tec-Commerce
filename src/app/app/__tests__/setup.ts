import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter:       () => ({ push: vi.fn(), replace: vi.fn() }),
}));
