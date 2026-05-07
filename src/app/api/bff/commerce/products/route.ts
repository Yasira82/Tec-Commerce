import { createHandler, GATEWAY_URL } from '@/lib/bff/createHandler';
import { NextRequest }                from 'next/server';
import { z }                          from 'zod';

const CreateProductSchema = z.object({
  title:        z.string().min(1),
  description:  z.string().optional(),
  price:        z.number().positive(),
  stock:        z.number().int().min(0),
  category:     z.string().optional(),
  condition:    z.string().optional(),
  images:       z.array(z.string()).optional(),
  shipping:     z.object({
    country:       z.string(),
    city:          z.string(),
    shipsTo:       z.array(z.string()),
    shippingCost:  z.number(),
    estimatedDays: z.string(),
  }).optional(),
  contact:      z.object({
    whatsapp: z.string().optional(),
    telegram: z.string().optional(),
    email:    z.string().optional(),
  }).optional(),
  warranty:     z.string().optional(),
  returnPolicy: z.string().optional(),
});

const DEFAULT_SHIPPING = {
  country:       'Unknown',
  city:          'Unknown',
  shipsTo:       [],
  shippingCost:  0,
  estimatedDays: 'Contact seller',
};

const DEFAULT_CONTACT = {
  whatsapp: undefined,
  telegram: undefined,
  email:    undefined,
};

const normalizeProduct = (p: Record<string, unknown>) => ({
  ...p,
  images:       Array.isArray(p.images) ? p.images : [],
  rating:       Number(p.rating)      || 0,
  reviewCount:  Number(p.reviewCount) || 0,
  condition:    p.condition           || 'new',
  shipping:     (p.shipping && typeof p.shipping === 'object')
    ? p.shipping
    : DEFAULT_SHIPPING,
  contact:      (p.contact && typeof p.contact === 'object')
    ? p.contact
    : DEFAULT_CONTACT,
});

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') ?? undefined;
    const limit    = searchParams.get('limit')    ?? '20';
    const offset   = searchParams.get('offset')   ?? '0';

    const params = new URLSearchParams({ limit, offset });
    if (category) params.set('category', category);

    const url = `${GATEWAY_URL}/api/v1/commerce/products?${params}`;
    console.log('[commerce/products] fetching:', url);

    const res = await fetch(url, {
      headers: {
        Authorization:    `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
        'x-request-id':   ctx.requestId,
        'x-internal-key': process.env.INTERNAL_SECRET ?? '',
      },
      cache: 'no-store',
    });

    console.log('[commerce/products] status:', res.status);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[commerce/products] error:', JSON.stringify(err));
      return { products: [] };
    }

    const data = await res.json();
    console.log('[commerce/products] raw data:', JSON.stringify(data).slice(0, 200));

    const raw = data?.data?.products ?? [];
    console.log('[commerce/products] products count:', raw.length);

    return { products: raw.map(normalizeProduct) };
  },
});

export const POST = createHandler({
  requireAuth: true,
  schema:      CreateProductSchema,
  handler: async ({ input, ctx, req }) => {
    const res = await fetch(`${GATEWAY_URL}/api/v1/commerce/products`, {
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        Authorization:    `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
        'x-request-id':   ctx.requestId,
        'x-internal-key': process.env.INTERNAL_SECRET ?? '',
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? 'Failed to create product');
    }

    const data = await res.json();
    const raw  = data?.data?.product ?? {};
    return { product: normalizeProduct(raw) };
  },
});
