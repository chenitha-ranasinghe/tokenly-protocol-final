import { NextRequest, NextResponse } from 'next/server';
import { getSharePayload } from '@/lib/archion-share-store';
import { getPortfolioShareMeta, PORTFOLIO_VIEWER_TOKEN } from '@/lib/portfolio-demo-seeds';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const payload = getSharePayload(token);

  if (!payload) {
    if (token === PORTFOLIO_VIEWER_TOKEN || token === 'DEMO' || token.startsWith('DEMO-')) {
      return NextResponse.json(getPortfolioShareMeta());
    }
    return NextResponse.json({ error: 'Link expired or invalid', code: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    token: payload.token,
    password_required: !!payload.passwordHash,
    watermark: payload.watermark,
    watermark_text: payload.watermarkText,
    client_name: payload.clientName,
    building_name: payload.buildingName,
    compliance_score: payload.complianceScore ?? 85,
    expires_at: new Date(payload.expiresAt).toISOString(),
    rooms: payload.rooms,
  });
}
