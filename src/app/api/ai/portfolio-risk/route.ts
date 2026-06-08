import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import { groqChat, GROQ_MODELS, parseJsonResponse } from '@/lib/groq';
import type { User, UserShare } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request) as User | null;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getDb();
    
    // 1. Get real user holdings
    const shares = await db.prepare(`
      SELECT us.*, p.name, p.brand, p.category, p.consensus_price, p.retail_price
      FROM user_shares us
      JOIN products p ON us.product_id = p.id
      WHERE us.user_id = ?
    `).all(user.id) as UserShare[];

    if (shares.length === 0) {
      return NextResponse.json({ error: 'No holdings found to analyze.' }, { status: 400 });
    }

    // 2. Compute basic risk metrics
    const totalValue = shares.reduce(
      (acc, s) => acc + Number(s.shares) * (Number(s.consensus_price) || Number(s.retail_price) || 0),
      0
    );
    const brandConcentration: Record<string, number> = {};
    const categoryConcentration: Record<string, number> = {};

    shares.forEach((s) => {
      const brand = s.brand ?? 'Unknown';
      const category = String(s.category ?? 'Unknown');
      const val = Number(s.shares) * (Number(s.consensus_price) || Number(s.retail_price) || 0);
      brandConcentration[brand] = (brandConcentration[brand] || 0) + val;
      categoryConcentration[category] = (categoryConcentration[category] || 0) + val;
    });

    const metrics = {
      total_value: totalValue,
      position_count: shares.length,
      top_brand: Object.entries(brandConcentration).sort((a,b) => b[1] - a[1])[0],
      top_category: Object.entries(categoryConcentration).sort((a,b) => b[1] - a[1])[0],
      liquidity_score: 75, // Placeholder for AMM depth
    };

    // 3. Feed to Llama 3.3 70B
    const raw = await groqChat({
      model: GROQ_MODELS.smart,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an institutional wealth advisor for luxury physical assets. Analyze portfolio risk and provide rebalancing recommendations in JSON.',
        },
        {
          role: 'user',
          content: `Analyze this luxury asset portfolio:
          Total Value: $${totalValue.toLocaleString()}
          Positions: ${shares.length}
          Brand Split: ${JSON.stringify(brandConcentration)}
          Category Split: ${JSON.stringify(categoryConcentration)}
          
          Return JSON:
          {
            "risk_score": <0-100>,
            "risk_level": "low|medium|high",
            "concentration_risk": "<explanation>",
            "liquidity_risk": "<explanation>",
            "diversification_score": <0-100>,
            "rebalancing_actions": [
              {"action": "BUY|SELL|HOLD", "asset_class": "<category>", "reason": "<logic>"}
            ],
            "market_outlook": "<1-2 sentences>",
            "advisor_notes": "<professional summary>"
          }`
        }
      ]
    });

    const analysis = parseJsonResponse(raw);

    return NextResponse.json({
      success: true,
      metrics,
      analysis,
      powered_by: 'Llama 3.3 70B'
    });

  } catch (error) {
    console.error('[RISK_ANALYZER]', error);
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 });
  }
}
