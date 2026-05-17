import { createHandler, GATEWAY_URL } from '@/lib/bff/createHandler';

const normalizeProduct = (p: Record<string, unknown>) => {
  const meta = (p.metadata && typeof p.metadata === 'object')
    ? p.metadata as Record<string, unknown>
    : {};
  return {
    id:          p.id,
    title:       p.title,
    description: p.description ?? '',
    price:       Number(p.price) || 0,
    stock:       Number(p.stock) || 0,
    category:    p.category ?? 'Other',
    condition:   (meta.condition as string) ?? 'new',
    images: Array.isArray(meta.images) && (meta.images as string[]).length > 0
      ? (meta.images as string[])
      : p.image_url ? [p.image_url as string] : [],
    sellerId:     p.seller_id,
    sellerName:   (meta.sellerName as string | undefined) ?? undefined,
    shipping: (meta.shipping && typeof meta.shipping === 'object')
      ? meta.shipping
      : { country: 'Unknown', city: 'Unknown', shipsTo: [], shippingCost: 0, estimatedDays: 'Contact seller' },
    contact: (meta.contact && typeof meta.contact === 'object')
      ? meta.contact
      : { whatsapp: undefined, telegram: undefined, email: undefined },
    rating:       Number(meta.rating)      || 0,
    reviewCount:  Number(meta.reviewCount) || 0,
    warranty:     (meta.warranty     as string | undefined) ?? undefined,
    returnPolicy: (meta.returnPolicy as string | undefined) ?? undefined,
    createdAt:    p.created_at,
  };
};

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const id  = req.url.split('/').pop() ?? '';
    const res = await fetch(`${GATEWAY_URL}/api/v1/commerce/products/${id}`, {
      headers: {
        Authorization:    `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
        'x-request-id':   ctx.requestId,
        'x-internal-key': process.env.INTERNAL_SECRET ?? '',
      },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Product not found');
    const data = await res.json();
    return { product: normalizeProduct(data?.data?.product ?? data?.data ?? {}) };
  },
});

export const DELETE = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const id  = req.url.split('/').pop() ?? '';
    const res = await fetch(`${GATEWAY_URL}/api/v1/commerce/products/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization:    `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
        'x-request-id':   ctx.requestId,
        'x-internal-key': process.env.INTERNAL_SECRET ?? '',
      },
    });
    if (!res.ok) throw new Error('Failed to delete product');
    return { success: true };
  },
});
