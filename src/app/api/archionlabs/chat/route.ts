import { NextRequest, NextResponse } from 'next/server';
import { groqChat, GROQ_MODELS } from '@/lib/groq';
import { authenticateRequest } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit-request';
import { jsonError } from '@/lib/api-response';
import type { User } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req) as User | null;
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');
    const rl = await enforceRateLimit(req, `archion:${user.id}`, 10, 60);
    if (rl) return rl;

    const { message } = await req.json() as {
      message: string;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    const systemPrompt = `You are ArchionAI — a senior architectural intelligence assistant embedded in the ArchionLabs platform, which is part of the Tokenly Protocol. You specialise in:

1. Sri Lankan Urban Development Authority (UDA) Planning Regulations 2023 — corridor widths, setbacks, floor area ratios, height limits, parking standards.
2. ISO 21542:2011 — Accessibility and usability of the built environment: door widths (900mm clear), ramp gradients (max 1:12), tactile surfaces, handrail heights (850–1000mm), lift dimensions, WC turning circles (2200mm).
3. Sri Lanka National Building Code (SLNBC) — fire compartmentation, exit widths, travel distances, sprinkler requirements.
4. Architectural design best-practices for residential, commercial, mixed-use, and industrial buildings.
5. Multi-Agent Reinforcement Learning (MARL) pedestrian simulation interpretation — egress scores, density heatmaps, bottleneck analysis.
6. Floor plan optimisation: room adjacency, natural light, cross-ventilation, structural grid efficiency.

Response style:
- Be precise and professional. Use metric units (mm and m).
- Cite specific clause numbers when referencing regulations (e.g. "UDA Section 7.4.2", "ISO 21542:2011 Clause 17.3").
- Provide actionable, specific advice — not generic statements.
- Keep responses under 280 words unless the question genuinely requires more depth.
- Use numbered lists only when listing sequential steps or multiple distinct items.`;

    const response = await groqChat({
      model:      GROQ_MODELS.smart,
      max_tokens: 600,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: message },
      ],
    });

    return NextResponse.json({ success: true, response });
  } catch (error) {
    console.error('[ArchionChat]', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, response: `ArchionAI is temporarily unavailable: ${msg}` },
      { status: 500 }
    );
  }
}
