import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit-request';
import { aiVisionBodySchema } from '@/lib/validation/schemas';
import { runAiVision } from '@/lib/services/ai-vision-service';
import { jsonError } from '@/lib/api-response';
import { getCorrelationId } from '@/lib/correlation';
import { withCorrelation } from '@/lib/logger';
import { aiVisionConfidenceHistogram } from '@/lib/metrics';
import type { User } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const log = withCorrelation(correlationId);

  const rl = await enforceRateLimit(request, 'ai-vision', 30, 60);
  if (rl) {
    rl.headers.set('x-request-id', correlationId);
    return rl;
  }

  try {
    const user = (await authenticateRequest(request)) as User | null;
    if (!user) {
      return jsonError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const rawBody: unknown = await request.json();
    const parsed = aiVisionBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError('Invalid request body', 400, 'VALIDATION_ERROR', {
        issues: parsed.error.flatten(),
      });
    }
    const body = parsed.data;
    const imageBase64 = body.image ?? body.imageBase64!;
    const productId = body.productId ?? body.vault_id!;

    const result = await runAiVision({
      user,
      imageBase64,
      productId,
      mediaType: body.mediaType,
      ip: request.headers.get('x-forwarded-for'),
    });

    aiVisionConfidenceHistogram.observe(result.confidence);

    const res = NextResponse.json(
      {
        authenticated: result.authenticated,
        confidence: result.confidence,
        certificateId: result.certificateId,
        verdict: result.verdict,
        notes: result.notes,
        forensics: result.forensics,
        powered_by: result.powered_by,
        disclaimer: result.disclaimer,
      },
      {
        status: 200,
        headers: {
          'x-request-id': correlationId,
          'Cache-Control': 'no-store',
        },
      }
    );
    return res;
  } catch (error) {
    log.error({ err: error }, 'ai_vision_failed');
    return jsonError('Vision analysis failed. Please try again.', 500, 'INTERNAL');
  }
}
