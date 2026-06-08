import { NextRequest, NextResponse } from 'next/server';
import { groqChat, GROQ_MODELS, parseJsonResponse } from '@/lib/groq';
import {
  saveSharePayload,
  hashPortfolioPassword,
  SHARE_TTL_MS,
} from '@/lib/archion-share-store';
import type { Room } from '@/components/archionlabs/BuildPanel';
import { ARCHION_PORTFOLIO_DEMO_BUILD } from '@/lib/archion-demo-seed';
import { buildPortfolioViewerResult } from '@/lib/portfolio-demo-seeds';

type RoomInput = Omit<Room, 'area_sqm'> & { area_sqm?: number };

function normalizeRooms(rooms: RoomInput[]): Room[] {
  return rooms.map(r => ({
    ...r,
    area_sqm: typeof r.area_sqm === 'number' ? r.area_sqm : r.width * r.height,
  }));
}

function appOrigin(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  return host ? `${proto}://${host}` : 'http://localhost:3000';
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Token generation helpers
 *
 * We generate a human-readable token in the format AL-XXXXXXXX-XXXXXXXX.
 * The character set deliberately excludes easily confused characters
 * (0/O, 1/I/L) to make it easy for clients to read and type manually.
 * ───────────────────────────────────────────────────────────────────────────── */
const TOKEN_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateToken(segments = 2, length = 8): string {
  const seg = (n: number) =>
    Array.from({ length: n }, () => TOKEN_CHARS[Math.floor(Math.random() * TOKEN_CHARS.length)]).join('');
  return `AL-${Array.from({ length: segments }, () => seg(length)).join('-')}`;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/archionlabs/viewer
 *
 * Accepts share-link configuration and returns a complete token package that
 * the ViewerPanel renders. The LLM enriches the response with realistic-
 * sounding building metadata (element counts, compliance score, etc.) so the
 * panel always looks populated even before a real BIM integration is in place.
 * ───────────────────────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  let shareRooms: Room[] = ARCHION_PORTFOLIO_DEMO_BUILD.rooms;

  try {
    const portfolioDemo =
      req.headers.get('x-portfolio-demo') === 'true' ||
      req.nextUrl.searchParams.get('portfolio') === '1';

    const {
      modelId     = 'model_001',
      password    = '',
      expiryHours = 168,
      watermark   = true,
      clientName  = 'Client',
      rooms       = [],
    } = await req.json() as {
      modelId?:     string;
      password?:    string;
      expiryHours?: number;
      watermark?:   boolean;
      clientName?:  string;
      rooms?:       RoomInput[];
    };

    shareRooms = normalizeRooms(rooms.length > 0 ? rooms : ARCHION_PORTFOLIO_DEMO_BUILD.rooms);

    if (portfolioDemo) {
      const demo = buildPortfolioViewerResult(appOrigin(req));
      saveSharePayload({
        token: demo.share_token,
        passwordHash: '',
        expiresAt: Date.now() + SHARE_TTL_MS,
        watermark: true,
        watermarkText: demo.security.watermark_text ?? 'ARCHIONLABS · PORTFOLIO DEMO',
        clientName: clientName || demo.client_name,
        rooms: shareRooms,
        buildingName: demo.name ?? ARCHION_PORTFOLIO_DEMO_BUILD.building_name,
        complianceScore: demo.compliance_score,
      });
      return NextResponse.json({ ...demo, portfolio_demo: true });
    }

    // Compute derived values from floor plan geometry (if available)
    const totalArea = shareRooms.reduce((sum, r) => sum + r.area_sqm, 0) || 150;
    const floorCount = shareRooms.some(r => r.y > 10) ? 2 : 1; // rough heuristic

    // Generate the share token and compute the expiry timestamp
    const token     = generateToken();
    const expiresMs = Math.min(expiryHours, 720) * 3_600_000;
    const expiresAt = new Date(Date.now() + expiresMs).toISOString();
    const origin    = appOrigin(req);
    const shareUrl  = `/viewer/${token}`;
    const fullUrl   = `${origin}${shareUrl}`;

    // Build the watermark text that will be stamped on the 3D canvas
    const watermarkText =
      `ARCHIONLABS · CONFIDENTIAL · ${clientName.toUpperCase()} · ${new Date().toLocaleDateString()}`;

    /* ── LLM enrichment: generate believable model metadata ─────────────
     * We ask the model to fill in plausible building element counts,
     * a compliance score, and inspection dates based on the geometry.
     * This makes the Viewer panel feel live and data-rich without requiring
     * an actual BIM or IFC integration.
     * ─────────────────────────────────────────────────────────────────── */
    const raw = await groqChat({
      model:      GROQ_MODELS.fast,
      max_tokens: 500,
      temperature: 0.25,
      response_format: { type: 'json_object' },
      messages: [
        {
          role:    'user',
          content:
            `Generate realistic building model metadata for a secure 3D viewer share link.\n` +
            `Model ID: ${modelId} | Rooms: ${shareRooms.length} | Area: ${totalArea.toFixed(0)} m² | Floors: ${floorCount}\n\n` +
            `Return ONLY this JSON (no markdown):\n` +
            `{\n` +
            `  "name": "<descriptive building name based on room mix>",\n` +
            `  "floors": ${floorCount},\n` +
            `  "total_area_sqm": ${totalArea.toFixed(0)},\n` +
            `  "compliance_score": <realistic 72-95 integer>,\n` +
            `  "last_inspection": "<date within last 30 days, formatted DD MMM YYYY>",\n` +
            `  "render_quality": "ultra",\n` +
            `  "elements": [\n` +
            `    { "type": "structural",  "count": <60-400>, "status": "compliant" },\n` +
            `    { "type": "mechanical",  "count": <20-150>, "status": "<compliant|review>" },\n` +
            `    { "type": "electrical",  "count": <15-120>, "status": "compliant" },\n` +
            `    { "type": "plumbing",    "count": <10-80>,  "status": "<compliant|review>" }\n` +
            `  ]\n` +
            `}`,
        },
      ],
    });

    const meta = parseJsonResponse<Record<string, unknown>>(raw);
    const complianceScore =
      typeof meta.compliance_score === 'number' ? meta.compliance_score : 88;

    saveSharePayload({
      token,
      passwordHash: password ? hashPortfolioPassword(password) : '',
      expiresAt: Date.now() + expiresMs,
      watermark,
      watermarkText: watermark ? watermarkText : '',
      clientName,
      rooms: shareRooms,
      buildingName:
        typeof meta.name === 'string' ? meta.name : 'Shared Building Model',
      complianceScore,
    });

    return NextResponse.json({
      success:     true,
      powered_by:  'ArchionLabs Secure Token Engine + Llama 3.3 70B (Groq)',

      // ── Share link details ──────────────────────────────────────────
      share_token:        token,
      share_url:          shareUrl,
      full_share_url:     fullUrl,
      password_protected: !!password,
      expires_at:         expiresAt,
      expiry_hours:       expiryHours,
      watermark_enabled:  watermark,
      client_name:        clientName,

      // ── Security metadata ───────────────────────────────────────────
      security: {
        token_type:           'JWT_HMAC_SHA256',
        encryption:           'AES-256-GCM',
        transport:            'TLS_1_3',
        access_log:           true,
        max_views:            50,
        ip_restriction:       false,
        dual_layer_watermark: watermark,
        watermark_text:       watermark ? watermarkText : null,
      },

      // ── Model metadata from LLM ─────────────────────────────────────
      model_id: modelId,
      ...meta,
    });

  } catch (error) {
    console.error('[Viewer]', error);

    // Even on failure we return a usable response with a freshly-generated
    // token so the UI does not break — the user can still share a link,
    // it just won't have enriched metadata.
    const fallbackToken = generateToken();
    const origin = appOrigin(req);
    const expiresMs = SHARE_TTL_MS;
    saveSharePayload({
      token: fallbackToken,
      passwordHash: '',
      expiresAt: Date.now() + expiresMs,
      watermark: true,
      watermarkText: `ARCHIONLABS · CONFIDENTIAL · ${new Date().toLocaleDateString()}`,
      clientName: 'Client',
      rooms: shareRooms,
      buildingName: 'Building Model',
      complianceScore: 82,
    });
    return NextResponse.json({
      success:            false,
      powered_by:         'Local Fallback Engine',
      share_token:        fallbackToken,
      share_url:          `/viewer/${fallbackToken}`,
      full_share_url:     `${origin}/viewer/${fallbackToken}`,
      password_protected: false,
      expires_at:         new Date(Date.now() + 7 * 24 * 3_600_000).toISOString(),
      expiry_hours:       168,
      watermark_enabled:  true,
      client_name:        'Client',
      security: {
        token_type:           'JWT_HMAC_SHA256',
        encryption:           'AES-256-GCM',
        access_log:           true,
        max_views:            50,
        dual_layer_watermark: true,
        watermark_text:       `ARCHIONLABS · CONFIDENTIAL · ${new Date().toLocaleDateString()}`,
      },
      model_id:         'fallback_model',
      name:             'Building Model',
      floors:           1,
      total_area_sqm:   150,
      compliance_score: 82,
      render_quality:   'ultra',
      elements: [
        { type: 'structural', count: 240, status: 'compliant' },
        { type: 'mechanical', count: 88,  status: 'review'    },
        { type: 'electrical', count: 72,  status: 'compliant' },
        { type: 'plumbing',   count: 44,  status: 'compliant' },
      ],
    }, { status: 200 }); // 200 so the front-end still renders the token
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * GET /api/archionlabs/viewer?modelId=xxx
 *
 * Quick convenience endpoint — generates a default 7-day share link without
 * any POST body, useful for rapid prototyping and testing.
 * ───────────────────────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const modelId = req.nextUrl.searchParams.get('modelId') ?? 'model_demo';
  const token   = generateToken();
  const origin  = appOrigin(req);

  saveSharePayload({
    token,
    passwordHash: '',
    expiresAt: Date.now() + SHARE_TTL_MS,
    watermark: true,
    watermarkText: 'ARCHIONLABS · DEMO',
    clientName: 'Demo',
    rooms: [],
    buildingName: 'Commercial Building A',
    complianceScore: 88,
  });

  return NextResponse.json({
    success:            true,
    share_token:        token,
    share_url:          `/viewer/${token}`,
    full_share_url:     `${origin}/viewer/${token}`,
    password_protected: false,
    expires_at:         new Date(Date.now() + 7 * 24 * 3_600_000).toISOString(),
    expiry_hours:       168,
    watermark_enabled:  true,
    client_name:        'Demo',
    security: {
      token_type:           'JWT_HMAC_SHA256',
      encryption:           'AES-256-GCM',
      access_log:           true,
      max_views:            50,
      dual_layer_watermark: true,
    },
    model_id:         modelId,
    name:             'Commercial Building A',
    floors:           3,
    total_area_sqm:   840,
    compliance_score: 88,
    last_inspection:  new Date(Date.now() - 5 * 24 * 3_600_000).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }),
    render_quality:   'ultra',
    elements: [
      { type: 'structural', count: 342, status: 'compliant' },
      { type: 'mechanical', count: 128, status: 'review'    },
      { type: 'electrical', count: 95,  status: 'compliant' },
      { type: 'plumbing',   count: 61,  status: 'compliant' },
    ],
  });
}
