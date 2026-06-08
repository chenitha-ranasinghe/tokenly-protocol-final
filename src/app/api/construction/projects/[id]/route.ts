import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import { jsonError } from '@/lib/api-response';
import { writeAuditLog } from '@/lib/audit';
import { canTokenizeProject, hashApprovalDocument } from '@/lib/legal-gate';
import { defaultMilestoneSchedule } from '@/lib/construction-timeline';
import { computeCRS } from '@/lib/crs';
import type { SQLParams } from '@/lib/db-types';
import { v4 as uuidv4 } from 'uuid';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const db = await getDb();
    const project = await db.prepare('SELECT * FROM construction_projects WHERE id = ?').get(id);
    if (!project) return jsonError('Not found', 404, 'NOT_FOUND');

    const bids = await db
      .prepare(
        `SELECT b.*, c.company_name, c.crs_score FROM construction_bids b
         JOIN construction_companies c ON c.id = b.company_id
         WHERE b.project_id = ? ORDER BY b.fixed_price_lkr ASC`
      )
      .all(id);

    const milestones = await db
      .prepare('SELECT * FROM construction_milestones WHERE project_id = ? ORDER BY sort_order')
      .all(id);

    return NextResponse.json({ project, bids, milestones });
  } catch (e) {
    console.error('construction project GET', e);
    return jsonError('Failed to load project', 500, 'INTERNAL');
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');

    const { id } = await ctx.params;
    const db = await getDb();
    const project = (await db.prepare('SELECT * FROM construction_projects WHERE id = ?').get(id)) as {
      owner_id: string;
      legal_status: string;
      approval_doc_hash: string | null;
      status: string;
      winning_bid_id: string | null;
      token_minted: number;
    } | undefined;

    if (!project) return jsonError('Not found', 404, 'NOT_FOUND');
    if (project.owner_id !== user.id) return jsonError('Forbidden', 403, 'FORBIDDEN');

    const body = await request.json();

    if (body.action === 'submit_legal') {
      const docContent = String(body.approval_document_text ?? body.land_deed_ref ?? id);
      const hash = hashApprovalDocument(docContent);
      await db
        .prepare(
          `UPDATE construction_projects SET legal_status = 'pending', approval_doc_hash = ?, status = 'pending_uda', updated_at = datetime('now') WHERE id = ?`
        )
        .run(hash, id);
      await writeAuditLog('legal_submitted', user.id, { targetId: id, targetType: 'construction_project', details: { hash } });
      return NextResponse.json({ ok: true, legal_status: 'pending', approval_doc_hash: hash });
    }

    if (body.action === 'approve_legal') {
      const hash = project.approval_doc_hash ?? hashApprovalDocument(id);
      await db
        .prepare(
          `UPDATE construction_projects SET legal_status = 'approved', status = 'approved', approval_doc_hash = ?, updated_at = datetime('now') WHERE id = ?`
        )
        .run(hash, id);

      for (const m of defaultMilestoneSchedule()) {
        await db
          .prepare(
            `INSERT OR IGNORE INTO construction_milestones (id, project_id, name, pct_value, sort_order, status)
             VALUES (?, ?, ?, ?, ?, 'pending')`
          )
          .run(uuidv4(), id, m.name, m.pct_value, m.sort_order);
      }

      await writeAuditLog('legal_approved', user.id, { targetId: id, targetType: 'construction_project' });
      return NextResponse.json({ ok: true, legal_status: 'approved', status: 'approved' });
    }

    if (body.action === 'open_bidding') {
      const gate = canTokenizeProject(project.legal_status as 'approved', project.approval_doc_hash);
      if (!gate.allowed) return jsonError(gate.reason ?? 'Legal gate', 400, 'FORBIDDEN');
      await db
        .prepare(`UPDATE construction_projects SET status = 'bidding', updated_at = datetime('now') WHERE id = ?`)
        .run(id);
      return NextResponse.json({ ok: true, status: 'bidding' });
    }

    if (body.action === 'mint_token') {
      const gate = canTokenizeProject(project.legal_status as 'approved', project.approval_doc_hash);
      if (!gate.allowed) return jsonError(gate.reason ?? 'Legal gate', 400, 'FORBIDDEN');
      await db
        .prepare(`UPDATE construction_projects SET token_minted = 1, updated_at = datetime('now') WHERE id = ?`)
        .run(id);
      await writeAuditLog('preconstruction_token_minted', user.id, { targetId: id, targetType: 'construction_project' });
      return NextResponse.json({ ok: true, token_minted: true });
    }

    if (body.action === 'accept_bid') {
      const bidId = String(body.bid_id ?? '');
      if (!bidId) return jsonError('bid_id required', 400, 'VALIDATION_ERROR');
      const bid = (await db
        .prepare('SELECT * FROM construction_bids WHERE id = ? AND project_id = ?')
        .get(bidId, id)) as { company_id: string; status: string } | undefined;
      if (!bid) return jsonError('Bid not found', 404, 'NOT_FOUND');
      await db
        .prepare(
          `UPDATE construction_bids SET status = 'rejected' WHERE project_id = ? AND id != ? AND status = 'submitted'`
        )
        .run(id, bidId);
      await db.prepare(`UPDATE construction_bids SET status = 'accepted' WHERE id = ?`).run(bidId);
      await db
        .prepare(
          `UPDATE construction_projects SET winning_bid_id = ?, status = 'in_construction', updated_at = datetime('now') WHERE id = ?`
        )
        .run(bidId, id);
      await writeAuditLog('construction_bid_accepted', user.id, {
        targetId: bidId,
        targetType: 'construction_bid',
        details: { projectId: id, companyId: bid.company_id },
      });
      return NextResponse.json({ ok: true, winning_bid_id: bidId, status: 'in_construction' });
    }

    if (body.action === 'verify_milestone') {
      const milestoneId = String(body.milestone_id ?? '');
      if (!milestoneId) return jsonError('milestone_id required', 400, 'VALIDATION_ERROR');
      const milestone = (await db
        .prepare('SELECT * FROM construction_milestones WHERE id = ? AND project_id = ?')
        .get(milestoneId, id)) as { pct_value: number; name: string } | undefined;
      if (!milestone) return jsonError('Milestone not found', 404, 'NOT_FOUND');
      await db
        .prepare(
          `UPDATE construction_milestones SET status = 'verified', verified_at = datetime('now') WHERE id = ?`
        )
        .run(milestoneId);
      const verified = (await db
        .prepare(
          `SELECT COALESCE(SUM(pct_value), 0) as unlocked FROM construction_milestones WHERE project_id = ? AND status = 'verified'`
        )
        .get(id)) as { unlocked: number };
      await writeAuditLog('construction_milestone_verified', user.id, {
        targetId: milestoneId,
        targetType: 'construction_milestone',
        details: { projectId: id, unlocked_pct: verified.unlocked, name: milestone.name },
      });
      if (project.winning_bid_id) {
        const bid = (await db
          .prepare('SELECT company_id FROM construction_bids WHERE id = ?')
          .get(project.winning_bid_id)) as { company_id: string } | undefined;
        if (bid) {
          const stats = (await db
            .prepare(
              `SELECT
                AVG(CASE WHEN status = 'verified' THEN 100 ELSE 0 END) as milestone_adherence,
                COUNT(*) as total
               FROM construction_milestones WHERE project_id = ?`
            )
            .get(id)) as { milestone_adherence: number };
          const crs = computeCRS({
            on_time_rate: 85,
            cost_accuracy: 5,
            milestone_adherence: stats.milestone_adherence ?? 70,
            client_rating: 80,
            bond_return_rate: 95,
          });
          await db
            .prepare(`UPDATE construction_companies SET crs_score = ?, updated_at = datetime('now') WHERE id = ?`)
            .run(crs, bid.company_id);
        }
      }
      return NextResponse.json({ ok: true, unlocked_pct: verified.unlocked });
    }

    const fields: string[] = [];
    const values: SQLParams = [];
    for (const key of [
      'title',
      'brief',
      'district',
      'floor_plan_json',
      'compliance_report_json',
      'estimated_land_value',
      'estimated_finished_value',
      'estimated_build_cost',
      'status',
    ] as const) {
      if (body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(
          key.includes('json') && typeof body[key] === 'object' ? JSON.stringify(body[key]) : body[key]
        );
      }
    }
    if (fields.length) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      await db.prepare(`UPDATE construction_projects SET ${fields.join(', ')} WHERE id = ?`).run(...values as SQLParams);
    }

    const updated = await db.prepare('SELECT * FROM construction_projects WHERE id = ?').get(id);
    return NextResponse.json({ project: updated });
  } catch (e) {
    console.error('construction project PATCH', e);
    return jsonError('Failed to update project', 500, 'INTERNAL');
  }
}
