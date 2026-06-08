import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/session';
import { checkRateLimit } from '@/lib/db';
import { computeWisdomPrice } from '@/lib/wisdom-engine';
import { groqChat, GROQ_MODELS, parseJsonResponse } from '@/lib/groq';
import type { User } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request) as User | null;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!await checkRateLimit(`ai-predict:${user.id}`, 10, 60)) {
      return NextResponse.json({ error: 'Rate limit reached. Please wait.' }, { status: 429 });
    }

    const body = await request.json() as { productId?: string; productName?: string; brand?: string; category?: string };
    const { productId, productName, brand, category } = body;
    if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });

    const wisdom = await computeWisdomPrice(productId);
    const currentPrice = wisdom?.estimatedPrice ?? 0;
    const confidence = wisdom?.confidence ?? 0;
    const signals = wisdom?.signals ?? [];

    const raw = await groqChat({
      model: GROQ_MODELS.smart,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a physical asset market analyst specialising in sneakers, watches, luxury goods, and collectibles in Southeast Asia. Respond ONLY with valid JSON.',
        },
        {
          role: 'user',
          content: `Analyse price outlook for:
Product: ${productName ?? productId}
Brand: ${brand ?? 'Unknown'}
Category: ${category ?? 'collectibles'}
Current Wisdom Price: $${currentPrice.toFixed(2)} (confidence: ${confidence}%)
Price Signals: ${JSON.stringify(signals)}

Return ONLY this JSON:
{
  "current_price": ${currentPrice},
  "forecast_30d": <number>,
  "forecast_60d": <number>,
  "forecast_90d": <number>,
  "trend": "bullish|bearish|neutral",
  "confidence": <0-100>,
  "factors": [
    {"name":"<factor>","impact":"positive|negative|neutral","weight":<0-1>,"detail":"<explanation>"}
  ],
  "recommendation": "buy|hold|sell",
  "rationale": "<2-3 sentence rationale>",
  "risk_level": "low|medium|high"
}`,
        },
      ],
    });

    const parsed = parseJsonResponse<Record<string, unknown>>(raw);
    return NextResponse.json({
      success: true,
      powered_by: 'Llama 3.3 70B (Groq)',
      wisdom_signals: signals,
      ...parsed,
    });
  } catch (error) {
    console.error('[AI-Predict]', error);
    return NextResponse.json({ error: 'Price prediction failed. Please try again.' }, { status: 500 });
  }
}
