import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ hash: string }> }) {
  try {
    const { hash } = await params;
    if (!hash || hash.length < 4) return NextResponse.json({ error: 'Invalid identifier' }, { status: 400 });

    const db = await getDb();
    const authRecord = await db.prepare(`
      SELECT a.cert_id, a.created_at, a.verdict, a.grade, a.verification_hash, a.confidence_score,
        p.name as product_name, p.brand, p.sku,
        u.name as authenticator_name, u.rrs_score as authenticator_rrs
      FROM authentications a
      JOIN products p ON a.product_id = p.id
      JOIN users u ON a.user_id = u.id
      WHERE a.verification_hash = ? OR a.cert_id = ?
    `).get(hash, hash) as Record<string, unknown> | undefined;

    if (!authRecord) return NextResponse.json({ error: 'Record not found in the protocol ledger.' }, { status: 404 });

    return NextResponse.json({
      success: true,
      record: {
        cert_id: authRecord.cert_id,
        timestamp: authRecord.created_at,
        verdict: authRecord.verdict,
        grade: authRecord.grade || 1,
        hash: authRecord.verification_hash,
        confidence_score: authRecord.confidence_score,
        asset: { name: authRecord.product_name, brand: authRecord.brand, sku: authRecord.sku },
        validator: { name: authRecord.authenticator_name, rrs: authRecord.authenticator_rrs },
      },
    });
  } catch (error) {
    console.error('[Explorer]', error);
    return NextResponse.json({ error: 'Record lookup failed' }, { status: 500 });
  }
}
