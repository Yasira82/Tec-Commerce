// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  delete process.env.E2E_MODE;
  delete process.env.NEXT_PUBLIC_E2E_MODE;
  delete process.env.CI;
  delete process.env.E2E_ALLOW_NETWORK;
});

afterEach(() => {
  delete process.env.E2E_MODE;
  delete process.env.NEXT_PUBLIC_E2E_MODE;
  delete process.env.CI;
  delete process.env.E2E_ALLOW_NETWORK;
});

describe('isE2eMode', () => {
  it('returns false when no env vars set', async () => {
    const { isE2eMode } = await import('../lib/server/e2e-mode');
    expect(isE2eMode()).toBe(false);
  });

  it('returns true when E2E_MODE=true', async () => {
    process.env.E2E_MODE = 'true';
    const { isE2eMode } = await import('../lib/server/e2e-mode');
    expect(isE2eMode()).toBe(true);
  });

  it('returns true when NEXT_PUBLIC_E2E_MODE=true', async () => {
    process.env.NEXT_PUBLIC_E2E_MODE = 'true';
    const { isE2eMode } = await import('../lib/server/e2e-mode');
    expect(isE2eMode()).toBe(true);
  });

  it('returns true when CI=true without E2E_ALLOW_NETWORK', async () => {
    process.env.CI = 'true';
    const { isE2eMode } = await import('../lib/server/e2e-mode');
    expect(isE2eMode()).toBe(true);
  });

  it('returns false when CI=true but E2E_ALLOW_NETWORK=true', async () => {
    process.env.CI                = 'true';
    process.env.E2E_ALLOW_NETWORK = 'true';
    const { isE2eMode } = await import('../lib/server/e2e-mode');
    expect(isE2eMode()).toBe(false);
  });
});

describe('e2eStub', () => {
  it('returns success=true for 2xx status', async () => {
    const { e2eStub } = await import('../lib/server/e2e-mode');
    const res  = e2eStub(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.error).toBeUndefined();
    expect(res.status).toBe(200);
  });

  it('returns success=false with error for non-2xx', async () => {
    const { e2eStub } = await import('../lib/server/e2e-mode');
    const res  = e2eStub(503);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('e2e-stub');
    expect(res.status).toBe(503);
  });

  it('merges extra fields into body', async () => {
    const { e2eStub } = await import('../lib/server/e2e-mode');
    const res  = e2eStub(200, { orderId: 'o-1' });
    const body = await res.json();
    expect(body.orderId).toBe('o-1');
  });
});
