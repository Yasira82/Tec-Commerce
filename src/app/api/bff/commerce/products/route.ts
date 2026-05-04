import { createHandler, GATEWAY_URL } from '@/lib/bff/createHandler';
import { NextRequest }                from 'next/server';
import { z }                          from 'zod';

const CreateProductSchema = z.object({
  title:       z.string().min(1),
  description: z.string().optional(),
  price:       z.number().positive(),
  stock:       z.number().int().min(0),
  category:    z.string().optional(),
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

    const res = await fetch(
      `${GATEWAY_URL}/api/v1/commerce/products?${params}`,
      {
        headers: {
          Authorization:    `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
          'x-request-id':   ctx.requestId,
          'x-internal-key': process.env.INTERNAL_SECRET ?? '',
        },
        cache: 'no-store',
      },
    );

    if (!res.ok) return { products: [] };
    const data = await res.json();
    return { products: data?.data?.products ?? [] };
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
    return { product: data?.data?.product };
  },
});
