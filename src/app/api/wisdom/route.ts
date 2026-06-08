import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/session';
import { updateProductWisdomPrice } from '@/lib/wisdom-engine';
import { getWisdomPriceCached, invalidateWisdomCache } from '@/lib/services/wisdom-service';
import { wisdomQuerySchema } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/rate-limit-request';
import { jsonError } from '@/lib/api-response';
import { z } from 'zod';

const wisdomPostSchema = z.object({
  productId: z.string().min(1).max(128),
});

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rl = await enforceRateLimit(request, 'wisdom-get', 120, 60);
  if (rl) return rl;

  try {
    const user = await authenticateRequest(request);
    if (!user) return jsonError('Authentication required', 401, 'UNAUTHORIZED');

    const q = wisdomQuerySchema.safeParse({
      productId: request.nextUrl.searchParams.get('productId'),
    });
    if (!q.success) {
      return jsonError('productId required', 400, 'VALIDATION_ERROR', {
        issues: q.error.flatten(),
      });
    }

    const wisdom = await getWisdomPriceCached(q.data.productId);
    if (!wisdom) return jsonError('Product not found', 404, 'NOT_FOUND');

    return NextResponse.json(
      { wisdom },
      { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } }
    );
  } catch (error) {
    console.error('[Wisdom] GET error:', error);
    return jsonError('Failed to compute price signal', 500, 'INTERNAL');
  }
}

export async function POST(request: NextRequest) {
  const rl = await enforceRateLimit(request, 'wisdom-post', 60, 60);
  if (rl) return rl;

  try {
    const user = await authenticateRequest(request);
    if (!user) return jsonError('Authentication required', 401, 'UNAUTHORIZED');

    const raw: unknown = await request.json();
    const parsed = wisdomPostSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError('Invalid body', 400, 'VALIDATION_ERROR', { issues: parsed.error.flatten() });
    }

    invalidateWisdomCache(parsed.data.productId);
    const newPrice = await updateProductWisdomPrice(parsed.data.productId);
    return NextResponse.json({ success: true, newConsensusPrice: newPrice });
  } catch (error) {
    console.error('[Wisdom] POST error:', error);
    return jsonError('Failed to update price', 500, 'INTERNAL');
  }
}
