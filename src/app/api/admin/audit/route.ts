/**
 * Audit Log API — Read-only access to immutable compliance logs
 * GET /api/admin/audit — Query audit logs with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/session';
import { queryAuditLogs, verifyAuditIntegrity, generateGlobalMerkleRoot, type AuditAction } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user || !user.is_admin) {
      return NextResponse.json({ error: 'Forbidden — Admin access required' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const actorId = searchParams.get('actorId') || undefined;
    const action = searchParams.get('action') as AuditAction | undefined;
    const targetId = searchParams.get('targetId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const [logs, totalResult] = await Promise.all([
      queryAuditLogs({ actorId, action, targetId, limit, offset }),
      queryAuditLogs({ actorId, action, targetId, limit: 9_999_999, offset: 0 }),
    ]);

    // Verify integrity of up to 10 recent entries in parallel
    const integrityChecks = await Promise.all(
      logs.slice(0, 10).map(async (log) => ({
        id:       log.id,
        verified: await verifyAuditIntegrity(log.id),
      }))
    );

    const globalMerkleRoot = await generateGlobalMerkleRoot();

    return NextResponse.json({
      globalMerkleRoot,
      logs,
      total:  totalResult.length,   // Real total count for pagination
      limit,
      offset,
      hasMore: offset + logs.length < totalResult.length,
      integrityChecks,
      note: 'Audit logs are append-only and tamper-evident. Integrity hashes are SHA-256 based.',
    });
  } catch (error) {
    console.error('Audit query error:', error);
    return NextResponse.json({ error: 'Failed to query audit logs' }, { status: 500 });
  }
}
