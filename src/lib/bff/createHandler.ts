import { z }           from 'zod';
import { NextRequest }  from 'next/server';
import { randomUUID } from 'crypto';
import { jwtVerify }   from 'jose';

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code   = 'BAD_REQUEST',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class UnauthorizedError extends AppError {
  constructor() { super('Unauthorized', 401, 'UNAUTHORIZED'); }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') { super(message, 403, 'FORBIDDEN'); }
}

export interface BFFContext {
  userId:      string;
  kycVerified: boolean;
  requestId:   string;
}

async function extractContext(req: NextRequest): Promise<BFFContext> {
  const token = req.cookies.get('tec_access_token')?.value;

  if (!token) {
    throw new UnauthorizedError();
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[BFF] JWT_SECRET not configured');
    throw new Error('JWT_SECRET not configured');
  }

  try {
    const encoded       = new TextEncoder().encode(secret);
    const { payload }   = await jwtVerify(token, encoded, {
      algorithms: ['HS256'],
    });

    const userId = payload.sub;
    if (!userId) throw new UnauthorizedError();

    return {
      userId,
      kycVerified: (payload as Record<string, unknown>).kycVerified === true,
      requestId:   req.headers.get('x-request-id') ?? randomUUID(),
    };
  } catch (err) {
    console.error('[BFF] JWT error:', (err as Error).message);
    if (err instanceof AppError) throw err;
    throw new UnauthorizedError();
  }
}

export const GATEWAY_URL = process.env.API_GATEWAY_URL ?? '';

export function createHandler<TInput = Record<string, never>, TOutput = unknown>(config: {
  schema?:      z.ZodSchema<TInput>;
  requireAuth?: boolean;
  requireKYC?:  boolean;
  handler: (args: {
    input: TInput;
    ctx:   BFFContext;
    req:   NextRequest;
  }) => Promise<TOutput>;
}) {
  return async (req: NextRequest): Promise<Response> => {
    let ctx: BFFContext = {
      userId:      'anonymous',
      kycVerified: false,
      requestId:   randomUUID(),
    };

    try {
      if (config.requireAuth !== false) {
        ctx = await extractContext(req);
      }

      if (config.requireKYC && !ctx.kycVerified) {
        throw new ForbiddenError('KYC_REQUIRED');
      }

      let input: TInput = {} as TInput;
      if (config.schema) {
        let body: unknown = {};
        try { body = await req.json(); } catch { /* empty body ok */ }
        input = config.schema.parse(body);
      }

      const result = await config.handler({ input, ctx, req });
      return Response.json(result, {
        headers: { 'X-Request-Id': ctx.requestId },
      });

    } catch (err) {
      if (err instanceof z.ZodError) {
        return Response.json(
          { error: 'VALIDATION_ERROR', details: err.flatten() },
          { status: 400 },
        );
      }
      if (err instanceof AppError) {
        return Response.json(
          { error: err.code, message: err.message },
          { status: err.status },
        );
      }
      console.error('[BFF] Unexpected error:', err);
      return Response.json(
        { error: 'INTERNAL_ERROR', message: 'Something went wrong' },
        { status: 500 },
      );
    }
  };
}

// C-123-adjacent resilience: the Railway backend cold-starts — the first hit
// after idle can 502/504 or drop the connection, then the next succeeds. For
// IDEMPOTENT GETs only, absorb exactly one such blip with a short backoff.
// Never used for POST/mutations (no double-submit risk).
export async function gatewayGet(url: string, init: RequestInit = {}): Promise<Response> {
  const attempt = () => fetch(url, { ...init, method: 'GET', cache: 'no-store' });
  try {
    const res = await attempt();
    if (res.status !== 502 && res.status !== 504) return res;
    await new Promise(r => setTimeout(r, 900));
    return attempt();
  } catch {
    await new Promise(r => setTimeout(r, 900));
    return attempt();
  }
}
