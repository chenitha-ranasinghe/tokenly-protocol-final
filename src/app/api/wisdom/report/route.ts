import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import { groqChat, GROQ_MODELS, parseJsonResponse } from '@/lib/groq';
import { PORTFOLIO_WISDOM_REPORT } from '@/lib/portfolio-demo-data';

// Simple in-memory cache for the report (1 hour)
let cachedReport: Record<string, unknown> | null = null;
let lastCacheTime = 0;
const CACHE_DURATION = 3600000; 

interface TradeRow { id: string; product_name: string; brand: string; category: string; trade_type: string; price_per_share: number; total_cost: number; created_at: string; }
interface CategoryRow { category: string; trade_count: number; total_volume: number; avg_change: number; }
interface PriceRow { name: string; brand: string; category: string; consensus_price: number; initial_consensus: number; price_change_pct: number; }

export interface MarketReport {
  headline: string;
  summary: string;
  top_performer_analysis: string;
  category_trends: Array<{
    category: string;
    sentiment: 'bullish' | 'bearish';
    insight: string;
  }>;
  macro_outlook: string;
  protocol_health: 'stable' | 'expanding' | 'contracting';
  next_week_forecast: string;
}

export async function GET(request: NextRequest) {
  try {
    const portfolioDemo = request.nextUrl.searchParams.get('portfolio') === '1';
    if (portfolioDemo) {
      return NextResponse.json({
        success: true,
        report: PORTFOLIO_WISDOM_REPORT,
        cached: false,
        portfolio_demo: true,
      });
    }

    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const now = Date.now();
    if (cachedReport && (now - lastCacheTime < CACHE_DURATION)) {
      return NextResponse.json({ success: true, report: cachedReport, cached: true });
    }

    const db = await getDb();
    
    // 1. Aggregate 7 days of data
    const last7Days = await db.prepare(`
      SELECT p.category, SUM(t.shares * t.price_per_share) as volume, COUNT(t.id) as trade_count
      FROM trades t
      JOIN products p ON t.product_id = p.id
      WHERE t.created_at >= datetime('now', '-7 days')
      GROUP BY p.category
    `).all() as TradeRow[];

    const topGainers = await db.prepare(`
      SELECT p.name, p.brand, ((p.consensus_price - p.retail_price) / p.retail_price * 100) as growth
      FROM products p
      WHERE p.consensus_price IS NOT NULL
      ORDER BY growth DESC
      LIMIT 5
    `).all() as TradeRow[];

    // 2. Feed to Llama 3.3 70B for Institutional Intelligence
    const raw = await groqChat({
      model: GROQ_MODELS.smart,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are the Tokenly Protocol Intelligence Oracle. Generate a weekly market report based on real protocol trade volume and asset performance. Respond ONLY with JSON.',
        },
        {
          role: 'user',
          content: `Protocol Data (Last 7 Days):
          Category Volume: ${JSON.stringify(last7Days)}
          Top Growth Assets: ${JSON.stringify(topGainers)}
          
          Generate JSON Report:
          {
            "headline": "<punchy market headline>",
            "summary": "<2-3 sentence executive summary>",
            "top_performer_analysis": "<why these assets grew>",
            "category_trends": [
              {"category": "<name>", "sentiment": "bullish|bearish", "insight": "<why>"}
            ],
            "macro_outlook": "<link to real luxury market trends>",
            "protocol_health": "stable|expanding|contracting",
            "next_week_forecast": "<prediction based on volume>"
          }`
        }
      ]
    });

    const report = parseJsonResponse<MarketReport>(raw);
    
    cachedReport = {
      ...report,
      data_points: { last7Days, topGainers },
      generated_at: new Date().toISOString()
    };
    lastCacheTime = now;

    return NextResponse.json({ success: true, report: cachedReport, cached: false });
  } catch (error) {
    console.error('[WISDOM_REPORT]', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
