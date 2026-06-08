import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import { jsonError } from '@/lib/api-response';
import { writeAuditLog } from '@/lib/audit';
import { canOpenPublicBidding } from '@/lib/legal-gate';
import { computeConstructionTimeline } from '@/lib/construction-timeline';

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');

    const body = await request.json();
    const projectId = String(body.project_id ?? '');
    const companyId = String(body.company_id ?? '');
    const fixedPrice = Number(body.fixed_price_lkr);

    if (!projectId || !companyId || !Number.isFinite(fixedPrice) || fixedPrice <= 0) {
      return jsonError('project_id, company_id, fixed_price_lkr required', 400, 'VALIDATION_ERROR');
    }

    const db = await getDb();
    const company = (await db.prepare('SELECT * FROM construction_companies WHERE id = ? AND user_id = ?').get(
      companyId,
      user.id
    )) as { id: string } | undefined;
    if (!company) return jsonError('Register a construction company first', 403, 'FORBIDDEN');

    const project = (await db.prepare('SELECT * FROM construction_projects WHERE id = ?').get(projectId)) as {
      legal_status: string;
      status: string;
      district: string;
    } | undefined;
    if (!project) return jsonError('Project not found', 404, 'NOT_FOUND');

    const bidGate = canOpenPublicBidding(project.legal_status as 'approved', project.status);
    if (!bidGate.allowed) return jsonError(bidGate.reason ?? 'Bidding closed', 400, 'FORBIDDEN');

    const timeline = body.timeline ?? computeConstructionTimeline({ district: project.district });
    const id = uuidv4();

    await db
      .prepare(
        `INSERT INTO construction_bids (
          id, project_id, company_id, fixed_price_lkr,
          earliest_weeks, likely_weeks, latest_weeks, confidence,
          milestone_schedule_json, bond_amount_lkr, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`
      )
      .run(
        id,
        projectId,
        companyId,
        fixedPrice,
        timeline.earliest_weeks,
        timeline.likely_weeks,
        timeline.latest_weeks,
        timeline.confidence,
        JSON.stringify(timeline),
        Number(body.bond_amount_lkr ?? 0)
      );

    await db
      .prepare(`UPDATE construction_projects SET status = 'bidding', updated_at = datetime('now') WHERE id = ?`)
      .run(projectId);

    await writeAuditLog('construction_bid_submitted', user.id, {
      targetId: id,
      targetType: 'construction_bid',
      details: { projectId, fixedPrice },
    });

    return NextResponse.json({ bid: { id, ...timeline, fixed_price_lkr: fixedPrice } }, { status: 201 });
  } catch (e) {
    console.error('construction bid POST', e);
    return jsonError('Failed to submit bid', 500, 'INTERNAL');
  }
}
