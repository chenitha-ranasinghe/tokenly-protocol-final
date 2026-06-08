import { NextRequest, NextResponse } from 'next/server';
import { getSharePayload, verifySharePassword } from '@/lib/archion-share-store';
import { jsonError } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  const { token, password } = (await req.json()) as { token?: string; password?: string };
  if (!token) return jsonError('Token required', 400, 'BAD_REQUEST');

  const payload = getSharePayload(token);
  if (!payload) return jsonError('Link expired or invalid', 404, 'NOT_FOUND');

  if (!verifySharePassword(payload, password ?? '')) {
    return jsonError('Incorrect password', 403, 'FORBIDDEN');
  }

  return NextResponse.json({ success: true });
}
