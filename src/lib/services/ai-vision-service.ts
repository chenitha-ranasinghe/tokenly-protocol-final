import { getDb } from '@/lib/db';
import { groqChat, GROQ_MODELS, parseJsonResponse } from '@/lib/groq';
import { randomUUID } from 'crypto';
import { writeAuditLog } from '@/lib/audit';
import type { User } from '@/lib/types';

type Verdict = 'AUTHENTIC' | 'COUNTERFEIT' | 'INCONCLUSIVE';

interface ForensicCheck {
  task: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'N/A';
  detail: string;
  confidence: number;
}

interface VisionResult {
  verdict: Verdict;
  confidence: number;
  notes: string;
  forensics: ForensicCheck[];
}

export interface AiVisionSuccess {
  authenticated: boolean;
  confidence: number;
  certificateId: string;
  verdict: Verdict;
  notes: string;
  forensics: ForensicCheck[];
  powered_by: string;
  disclaimer: string;
}

export async function runAiVision(params: {
  user: User;
  imageBase64: string;
  productId: string;
  mediaType?: string;
  ip?: string | null;
}): Promise<AiVisionSuccess> {
  const { user, imageBase64, productId, mediaType: mt, ip } = params;

  const base64Clean = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const mediaType =
    mt && ['image/jpeg', 'image/png', 'image/webp'].includes(mt) ? mt : 'image/jpeg';
  const dataUrl = `data:${mediaType};base64,${base64Clean}`;

  const db = await getDb();
  const product = (await db
    .prepare('SELECT name, brand, sku, category FROM products WHERE id = ?')
    .get(productId)) as Record<string, unknown> | undefined;
  const ctx = product
    ? `${product.name} by ${product.brand} (${product.category}, SKU: ${product.sku})`
    : `Product ID: ${productId}`;

  const raw = await groqChat({
    model: GROQ_MODELS.vision,
    max_tokens: 800,
    messages: [
      {
        role: 'system',
        content:
          'You are a certified physical asset authentication specialist. Analyse images for counterfeits. You MUST respond with ONLY valid JSON — no markdown, no explanation, just the JSON object.',
      },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          {
            type: 'text',
            text: `Authenticate this item: ${ctx}
Inspect: stitching, labels, serial numbers, material texture, proportions, logo placement, hardware finish, packaging.

Return ONLY this JSON (no markdown, no extra text):
{
  "verdict": "AUTHENTIC" or "COUNTERFEIT" or "INCONCLUSIVE",
  "confidence": <integer 0-100>,
  "notes": "<2-3 sentence professional assessment>",
  "forensics": [
    {"task":"<check name>","status":"PASS or FAIL or WARN or N/A","detail":"<specific observation>","confidence":<0-100>},
    {"task":"<check name>","status":"PASS or FAIL or WARN or N/A","detail":"<specific observation>","confidence":<0-100>},
    {"task":"<check name>","status":"PASS or FAIL or WARN or N/A","detail":"<specific observation>","confidence":<0-100>},
    {"task":"<check name>","status":"PASS or FAIL or WARN or N/A","detail":"<specific observation>","confidence":<0-100>}
  ]
}`,
          },
        ],
      },
    ],
  });

  const parsed = parseJsonResponse<Partial<VisionResult>>(raw);
  const validVerdicts: Verdict[] = ['AUTHENTIC', 'COUNTERFEIT', 'INCONCLUSIVE'];
  const verdict = validVerdicts.includes(parsed.verdict as Verdict)
    ? (parsed.verdict as Verdict)
    : 'INCONCLUSIVE';
  const confPct =
    typeof parsed.confidence === 'number' ? Math.min(100, Math.max(0, parsed.confidence)) : 50;
  const forensics = Array.isArray(parsed.forensics) ? parsed.forensics : [];

  const certificateId = randomUUID();
  const authenticated = verdict === 'AUTHENTIC' && confPct >= 70;

  await writeAuditLog('ai_vision', user.id, {
    targetId: productId,
    targetType: 'ai_vision',
    ipAddress: ip ?? undefined,
    details: { verdict, confidence: confPct, certificateId },
  });

  return {
    authenticated,
    confidence: Math.round((confPct / 100) * 100) / 100,
    certificateId,
    verdict,
    notes: parsed.notes ?? 'Analysis complete.',
    forensics,
    powered_by: 'Llama Vision (Groq)',
    disclaimer:
      'AI screening only. CAN human authenticator required for final certification on items above $200.',
  };
}
