import { createHandler, GATEWAY_URL, gatewayGet } from '@/lib/bff/createHandler';
import { z }                          from 'zod';

const CreateProductSchema = z.object({
  title:        z.string().min(1),
  description:  z.string().optional(),
  price:        z.number().positive(),
  stock:        z.number().int().min(0),
  category:     z.string().optional(),
  condition:    z.string().optional(),
  images:       z.array(z.string()).optional(),
  shipping: z.object({
    country:       z.string(),
    city:          z.string(),
    shipsTo:       z.array(z.string()),
    shippingCost:  z.number(),
    estimatedDays: z.string(),
  }).optional(),
  contact: z.object({
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
  shipsTo:       [] as string[],
  shippingCost:  0,
  estimatedDays: 'Contact seller',
};

const DEFAULT_CONTACT = {
  whatsapp: undefined as string | undefined,
  telegram: undefined as string | undefined,
  email:    undefined as string | undefined,
};

// ✅ normalizeProduct — يعمل map صح بين backend و frontend types
const normalizeProduct = (p: Record<string, unknown>) => {
  const meta = (p.metadata && typeof p.metadata === 'object')
    ? p.metadata as Record<string, unknown>
    : {};

  return {
    id:           p.id,
    title:        p.title,
    description:  p.description ?? '',
    price:        Number(p.price) || 0,
    stock:        Number(p.stock) || 0,
    category:     p.category ?? 'Other',
    condition:    (meta.condition as string) ?? 'new',
    // ✅ images[] من metadata أو image_url كـ fallback
    images: Array.isArray(meta.images) && (meta.images as string[]).length > 0
      ? (meta.images as string[])
      : p.image_url
        ? [p.image_url as string]
        : [],
    sellerId:     p.seller_id,
    sellerName:   (meta.sellerName as string | undefined) ?? undefined,
    shipping: (meta.shipping && typeof meta.shipping === 'object')
      ? meta.shipping
      : DEFAULT_SHIPPING,
    contact: (meta.contact && typeof meta.contact === 'object')
      ? meta.contact
      : DEFAULT_CONTACT,
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
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') ?? undefined;
    const limit    = searchParams.get('limit')    ?? '20';
    const offset   = searchParams.get('offset')   ?? '0';

    const params = new URLSearchParams({ limit, offset });
    if (category) params.set('category', category);

    const res = await gatewayGet(
      `${GATEWAY_URL}/api/v1/commerce/products?${params}`,
      {
        headers: {
          Authorization:    `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
          'x-request-id':   ctx.requestId,
          ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
        },
        cache: 'no-store',
      },
    );

    if (!res.ok) return { products: [] };

    const data = await res.json();
    const raw  = data?.data?.products ?? [];
    return { products: raw.map(normalizeProduct) };
  },
});

export const POST = createHandler({
  requireAuth: true,
  schema:      CreateProductSchema,
  handler: async ({ input, ctx, req }) => {
    const res = await fetch(`${GATEWAY_URL}/api/v1/commerce/products`, {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        Authorization:    `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
        'x-request-id':   ctx.requestId,
        ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
      },
      // ✅ بعت كل الـ fields للـ backend
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message ?? 'Failed to create product');
    }

    const data = await res.json();
    const raw  = data?.data?.product ?? {};
    return { product: normalizeProduct(raw) };
  },
});
