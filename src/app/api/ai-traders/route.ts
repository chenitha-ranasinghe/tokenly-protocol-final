import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/session';
import { checkRateLimit, getDb } from '@/lib/db';
import { groqChat, GROQ_MODELS, parseJsonResponse } from '@/lib/groq';
import type { User } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request) as User | null;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!await checkRateLimit(`ai-traders:${user.id}`, 5, 60)) {
      return NextResponse.json({ error: 'Rate limit reached.' }, { status: 429 });
    }

    const db = await getDb();
    const recentTrades = await db.prepare(`
      SELECT t.price, t.shares, t.created_at, p.name as product_name, p.brand, p.category
      FROM trades t JOIN products p ON t.product_id = p.id
      ORDER BY t.created_at DESC LIMIT 10
    `).all() as Record<string, unknown>[];

    const raw = await groqChat({
      model: GROQ_MODELS.smart,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a physical asset market analyst. Generate realistic AI trader activity based on recent market data. Respond ONLY with valid JSON.',
        },
        {
          role: 'user',
          content: `Recent platform trades: ${JSON.stringify(recentTrades.slice(0, 5))}

Generate AI trader market commentary. Return ONLY this JSON:
{
  "market_sentiment": "bullish|bearish|neutral",
  "sentiment_score": <0-100>,
  "traders": [
    {
      "name": "<trader alias>",
      "strategy": "<strategy name>",
      "action": "buy|sell|hold|watch",
      "target": "<product or category>",
      "rationale": "<1-2 sentence reasoning>",
      "confidence": <0-100>
    }
  ],
  "market_insight": "<2-3 sentence overall market insight>",
  "hot_categories": ["<category>","<category>"]
}`,
        },
      ],
    });

    const parsed = parseJsonResponse<Record<string, unknown>>(raw);
    return NextResponse.json({ success: true, powered_by: 'Llama 3.3 70B (Groq)', ...parsed });
  } catch (error) {
    console.error('[AI-Traders]', error);
    return NextResponse.json({ error: 'AI trader data unavailable.' }, { status: 500 });
  }
}
