import { NextRequest, NextResponse } from 'next/server';
import { groqChat, GROQ_MODELS, parseJsonResponse } from '@/lib/groq';
import { PORTFOLIO_COMPLIANCE_RESULT } from '@/lib/portfolio-demo-seeds';
import { enforceRateLimit } from '@/lib/rate-limit-request';
import { jsonError } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous';
    const rl = await enforceRateLimit(req, `archion:compliance:${ip}`, 5, 60);
    if (rl) return rl;

    const portfolioDemo = req.headers.get('x-portfolio-demo') === 'true';

    const {
      modelType   = 'ifc_model',
      propertyId  = 'prop_unknown',
      description = '',
      jurisdiction = 'SL_UDA_2023',
      imageBase64,
      rooms = [],
    } = await req.json() as {
      modelType?:    string;
      propertyId?:   string;
      description?:  string;
      jurisdiction?: string;
      imageBase64?:  string;
      rooms?:        Array<{
        id: string; name: string; type: string;
        width: number; height: number; x: number; y: number; area_sqm: number;
      }>;
    };

    /* ── Decide which model to use ────────────────────────────────────────
     * If the user uploaded a floor-plan image we switch to the vision model
     * so the AI can actually analyse the visual layout. Otherwise we use the
     * fast text model with the structured room data from Archion Build.
     * ─────────────────────────────────────────────────────────────────── */
    const useVision  = !!imageBase64;
    const modelToUse = useVision ? GROQ_MODELS.vision : GROQ_MODELS.smart;
    const hasRooms   = rooms.length > 0;

    const roomsSummary = hasRooms
      ? rooms
          .map(r => `${r.name} (${r.type}): ${r.width} m × ${r.height} m = ${r.area_sqm} m²`)
          .join('; ')
      : 'No structured room data provided — analysis based on image or description only.';

    /* ── Build the prompt ────────────────────────────────────────────────
     * The prompt structure differs slightly for vision vs text mode, but
     * the expected JSON output schema is identical in both cases so the
     * front-end never needs to branch on the model type.
     * ─────────────────────────────────────────────────────────────────── */
    const systemPrompt =
      `You are a senior Sri Lankan building compliance engineer with 20 years' experience. ` +
      `You specialise in:\n` +
      `• Sri Lanka Urban Development Authority (UDA) Planning Regulations 2023\n` +
      `• ISO 21542:2011 — Accessibility and usability of the built environment\n` +
      `• Sri Lanka National Building Code (SLNBC) — fire safety and structural standards\n\n` +
      `Always cite specific clause numbers. Estimate remediation costs in Sri Lankan Rupees (LKR). ` +
      `Confidence scores reflect certainty of the finding (0–100). ` +
      `Respond ONLY with valid JSON, no markdown fences, no commentary.`;

    const analysisInstruction = useVision
      ? `Analyse the attached floor plan image against Sri Lankan UDA 2023, ISO 21542:2011, and SLNBC fire safety standards.\n\n` +
        `Visually assess: corridor widths (≥1200 mm), door widths (≥900 mm clear), accessible toilet dimensions (≥2200 mm × 2200 mm), ` +
        `ramp gradients (≤1:12), emergency exit paths, fire compartmentation, tactile surface provisions, ` +
        `and structural grid compliance.\n\n` +
        (hasRooms ? `Supplementary structured room data: ${roomsSummary}\n\n` : '') +
        `Property ID: ${propertyId} | Model type: ${modelType}`
      : `Perform a full regulatory compliance audit for property ${propertyId}.\n\n` +
        `Model type: ${modelType} | Jurisdiction: ${jurisdiction}\n` +
        `Room data: ${roomsSummary}\n` +
        (description ? `Additional description: ${description}\n` : '') +
        `\nAssess against SL UDA 2023, ISO 21542:2011, and SLNBC. ` +
        `Focus on corridor widths, door clearances, accessible facilities, ramp gradients, and fire egress.`;

    const jsonSchema =
      `\n\nReturn ONLY this exact JSON structure:\n` +
      `{\n` +
      `  "overall_compliance_score": <0-100 integer>,\n` +
      `  "confidence": <0.0-1.0>,\n` +
      `  "jurisdictions_checked": ["SL_UDA_2023", "ISO_21542:2011", "SLNBC_FIRE"],\n` +
      `  "summary": "<3 sentence professional compliance summary>",\n` +
      `  "violations": [\n` +
      `    {\n` +
      `      "id": "v_001",\n` +
      `      "severity": "<critical|major|minor>",\n` +
      `      "jurisdiction": "<SL_UDA_2023|ISO_21542:2011|SLNBC_FIRE>",\n` +
      `      "clause": "<specific clause number>",\n` +
      `      "description": "<precise finding referencing measured dimensions where possible>",\n` +
      `      "confidence_score": <0-100>,\n` +
      `      "fix_type": "<brief remediation type>",\n` +
      `      "estimated_cost_lkr": <integer LKR estimate>\n` +
      `    }\n` +
      `  ]\n` +
      `}`;

    // Build the user message — either text or [text + image] for vision
    const userContent = useVision
      ? [
          { type: 'text'      as const, text:      analysisInstruction + jsonSchema },
          { type: 'image_url' as const, image_url: { url: imageBase64! } },
        ]
      : analysisInstruction + jsonSchema;

    const raw = await groqChat({
      model:      modelToUse,
      max_tokens: 1400,
      temperature: 0.2,
      // JSON mode only works for text models; vision model returns free text
      ...(useVision ? {} : { response_format: { type: 'json_object' as const } }),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent   },
      ],
    });

    const parsed = parseJsonResponse<Record<string, unknown>>(raw);

    // Sanity-check: make sure we have the required top-level fields
    if (typeof parsed.overall_compliance_score !== 'number') {
      throw new Error('LLM returned unexpected shape');
    }

    return NextResponse.json({
      success:     true,
      powered_by:  useVision ? 'Llama 4 Scout Vision (Groq)' : 'Llama 3.3 70B (Groq)',
      ...parsed,
    });

  } catch (error) {
    console.error('[Compliance]', error);

    if (req.headers.get('x-portfolio-demo') === 'true') {
      return NextResponse.json({
        success: true,
        powered_by: 'Compliance Oracle · Portfolio Demo (fallback)',
        ...PORTFOLIO_COMPLIANCE_RESULT,
        portfolio_demo: true,
      });
    }

    return NextResponse.json({
      success:                  false,
      overall_compliance_score: 0,
      confidence:               0,
      jurisdictions_checked:    ['SYSTEM_ERROR'],
      summary:                  'The compliance analysis engine encountered an error during processing. Please retry or check your API key.',
      violations: [
        {
          id:               'sys_error',
          severity:         'critical',
          jurisdiction:     'SYSTEM',
          clause:           'HTTP_500',
          description:      error instanceof Error ? error.message : String(error),
          confidence_score: 100,
          fix_type:         'Retry the request or verify API key configuration.',
          estimated_cost_lkr: 0,
        },
      ],
    }, { status: 500 });
  }
}
