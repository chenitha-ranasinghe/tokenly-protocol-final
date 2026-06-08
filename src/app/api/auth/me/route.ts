import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/session';
import type { User } from '@/lib/types';

const SAFE_FIELDS = [
  'id','name','email','points','experiment_group','total_reviews',
  'accurate_reviews','rrs_score','created_at','wallet_address',
  'total_trades','is_admin','is_id_verified',
] as const;

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request) as User | null;
    if (!user) return NextResponse.json({ user: null }, { status: 401 });

    // Return only safe fields — never password_hash, private_key, session_token
    const safe = Object.fromEntries(
      SAFE_FIELDS.map((k) => [k, (user as unknown as Record<string, unknown>)[k] ?? null])
    );
    return NextResponse.json({ user: safe });
  } catch (error) {
    console.error('[Auth/Me]', error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
