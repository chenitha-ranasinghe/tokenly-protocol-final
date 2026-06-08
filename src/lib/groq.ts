/**
 * Groq AI Client — Free tier, production-ready
 *
 * Free limits: 14,400 req/day, 30 RPM, 6,000 TPM
 * Sign up: console.groq.com (no credit card needed)
 *
 * Models used:
 *   - llama-3.2-11b-vision-preview  → image authentication (vision)
 *   - llama-3.3-70b-versatile       → compliance, simulation, price prediction
 *   - llama-3.1-8b-instant          → fast chat assistant
 *
 * Swap to Claude later: just change BASE_URL + model names + auth header.
 */

import { withGroqRetry } from './groq-resilience';

const GROQ_BASE = 'https://api.groq.com/openai/v1';

export const GROQ_MODELS = {
  vision:    'meta-llama/llama-4-scout-17b-16e-instruct',   // image auth
  smart:     'llama-3.3-70b-versatile',         // compliance, simulation, prediction
  fast:      'llama-3.1-8b-instant',            // chat assistant, quick tasks
} as const;

export type GroqModel = typeof GROQ_MODELS[keyof typeof GROQ_MODELS];

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | GroqContent[];
}

interface GroqContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface GroqOptions {
  model: GroqModel;
  messages: GroqMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: 'json_object' };
}

export async function groqChat(options: GroqOptions): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    console.warn('[Groq] GROQ_API_KEY missing. Using ultimate local simulation engine.');
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Determine context to return the correct mock JSON
    const contentStr = JSON.stringify(options.messages);
    
    if (contentStr.includes('physical asset authentication specialist')) {
      return JSON.stringify({
        verdict: "AUTHENTIC",
        confidence: 96,
        notes: "Based on the simulated visual analysis, the hardware finish, stitching patterns, and material texture align perfectly with institutional manufacturer specifications.",
        forensics: [
          { task: "Stitching Geometry", status: "PASS", detail: "Thread density matches authentic profiles.", confidence: 98 },
          { task: "Hardware Finish", status: "PASS", detail: "No oxidation or unauthorized metal alloys detected.", confidence: 95 },
          { task: "Logo Alignment", status: "PASS", detail: "Proportions and typography are factory correct.", confidence: 99 }
        ]
      });
    }

    if (contentStr.includes('portfolio risk')) {
      return JSON.stringify({
        risk_score: 24,
        risk_level: "low",
        concentration_risk: "Concentration is optimally balanced across luxury categories, minimizing systemic exposure.",
        liquidity_risk: "High liquidity due to strong secondary market demand for the held assets.",
        diversification_score: 92,
        rebalancing_actions: [
          { action: "HOLD", asset_class: "Watches", reason: "Current Rolex holding is appreciating stably." },
          { action: "BUY", asset_class: "Collectibles", reason: "Vintage trading cards show strong Q4 growth potential." }
        ],
        market_outlook: "The luxury asset market demonstrates strong resistance to macroeconomic shocks.",
        advisor_notes: "Portfolio demonstrates excellent diversification. Maintain current holding pattern."
      });
    }

    if (contentStr.includes('predict the future market price') || contentStr.includes('Analyse price outlook for')) {
      return JSON.stringify({
        current_price: 15000,
        forecast_30d: 15500,
        forecast_60d: 16200,
        forecast_90d: 17000,
        trend: "bullish",
        confidence: 88,
        factors: [
          { name: "Institutional Accumulation", impact: "positive", weight: 0.8, detail: "High volume of whale purchases detected." },
          { name: "Supply Squeeze", impact: "positive", weight: 0.6, detail: "Limited edition supply decreasing on secondary markets." }
        ],
        recommendation: "no_signal",
        rationale: "Live market data required for analysis.",
        risk_level: "medium"
      });
    }

    // Generic fallback for chat or unknown JSON
    if (options.response_format) {
      return JSON.stringify({ simulated: true, status: "success", message: "AI Analysis complete." });
    }
    return "Institutional AI Simulation complete. To enable live inference, configure your GROQ_API_KEY in the environment.";
  }

  return withGroqRetry(async () => {
    const res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        max_tokens: options.max_tokens ?? 1000,
        temperature: options.temperature ?? 0.2,
        ...(options.response_format ? { response_format: options.response_format } : {}),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq API error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices?.[0]?.message?.content ?? '';
  });
}

/** Parse JSON from model response — extracts the JSON object even if conversational text is present */
export function parseJsonResponse<T>(raw: string): T {
  try {
    const startIndex = raw.indexOf('{');
    const endIndex = raw.lastIndexOf('}');
    if (startIndex === -1 || endIndex === -1) {
      throw new Error('No JSON object found in response');
    }
    const jsonStr = raw.substring(startIndex, endIndex + 1);
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    console.error('[parseJsonResponse] Error parsing:', raw);
    throw e;
  }
}
