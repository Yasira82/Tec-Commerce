import { test, expect } from '@playwright/test';

test.skip(!!process.env.CI, 'Requires Pi Browser authenticated session');

const mockProduct = {
  id:          'prod-1',
  title:       'Test Product',
  price:       10,
  currency:    'PI',
  category:    'Electronics',
  sellerId:    'other-user',
  description: '',
  imageUrl:    '',
  createdAt:   new Date().toISOString(),
};

// ── Page load ─────────────────────────────────────────────
test.describe('Commerce /app', () => {
  test('الصفحة بتتحمل', async ({ page }) => {
    await page.goto('/app');
    await expect(page).toHaveURL(/\/app/);
  });

  test('فيها Products tab', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByText(/Products/i)).toBeVisible();
  });

  test('فيها Orders tab', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByText(/Orders/i)).toBeVisible();
  });

  test('فيها Sell tab', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByText(/Sell|\+ Sell/i)).toBeVisible();
  });
});

// ── BFF — no Railway calls ────────────────────────────────
test.describe('BFF routing', () => {
  test('products مش بيكل Railway مباشرة', async ({ page }) => {
    const railwayCall = page.waitForRequest(
      req => req.url().includes('railway.app') && req.url().includes('products'),
      { timeout: 3000 },
    ).catch(() => null);

    await page.goto('/app');
    expect(await railwayCall).toBeNull();
  });

  test('orders مش بيكل Railway مباشرة', async ({ page }) => {
    const railwayCall = page.waitForRequest(
      req => req.url().includes('railway.app') && req.url().includes('orders'),
      { timeout: 3000 },
    ).catch(() => null);

    await page.goto('/app');
    expect(await railwayCall).toBeNull();
  });
});

// ── handleBuy → Hub ───────────────────────────────────────
test.describe('handleBuy → Hub', () => {
  test('Buy يروح لـ Hub مع params صح', async ({ page }) => {
    await page.route('/api/bff/commerce/products', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ products: [mockProduct] }) }),
    );
    await page.route('/api/bff/commerce/orders', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ orders: [] }) }),
    );

    let hubUrl = '';
    page.on('request', req => {
      if (req.url().includes('hub.tecosystem.app')) hubUrl = req.url();
    });

    await page.goto('/app');
    await page.waitForSelector('text=Test Product', { timeout: 5000 });

    const buyBtn = page.getByTestId('buy-prod-1');
    if (await buyBtn.isVisible()) {
      await buyBtn.click();
      expect(hubUrl).toContain('pay=1');
      expect(hubUrl).toContain('amount=10');
      expect(hubUrl).toContain('prod-1');
      expect(hubUrl).toContain('commerce.tecosystem.app');
    }
  });
});

// ── payment_status=success ────────────────────────────────
test.describe('payment_status=success', () => {
  test('يكال order endpoint', async ({ page }) => {
    let orderCreated = false;

    await page.route('/api/bff/commerce/orders', async route => {
      if (route.request().method() === 'POST') {
        orderCreated = true;
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      } else {
        await route.fulfill({ status: 200, body: JSON.stringify({ orders: [] }) });
      }
    });
    await page.route('/api/bff/commerce/products', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ products: [] }) }),
    );

    await page.goto('/app?payment_status=success&product_id=prod-1&payment_id=pay-123&txid=tx-123');
    await page.waitForTimeout(2000);
    expect(orderCreated).toBe(true);
  });

  test('يظهر toast بعد payment', async ({ page }) => {
    await page.route('/api/bff/commerce/orders', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ orders: [] }) }),
    );
    await page.route('/api/bff/commerce/products', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ products: [] }) }),
    );

    await page.goto('/app?payment_status=success&product_id=prod-1&payment_id=pay-123&txid=tx-123');
    await expect(page.getByText(/successful|Purchase|Order/i)).toBeVisible({ timeout: 5000 });
  });
});

// ── CSRF ──────────────────────────────────────────────────
test.describe('CSRF', () => {
  test('POST order يبعت x-csrf-token', async ({ page }) => {
    let csrfSent = false;

    await page.route('/api/bff/commerce/orders', async route => {
      if (route.request().method() === 'POST') {
        csrfSent = !!route.request().headers()['x-csrf-token'];
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      } else {
        await route.fulfill({ status: 200, body: JSON.stringify({ orders: [] }) });
      }
    });
    await page.route('/api/bff/commerce/products', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ products: [] }) }),
    );

    await page.goto('/app?payment_status=success&product_id=prod-1&payment_id=pay-123&txid=tx-123');
    await page.waitForTimeout(2000);
    expect(csrfSent).toBe(true);
  });
});

// ── Health ────────────────────────────────────────────────
test.describe('API health', () => {
  test('GET /api/health → 200', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
  });
});
