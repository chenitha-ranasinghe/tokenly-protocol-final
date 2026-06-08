/**
 * Construction Milestone Tracking System
 *
 * GET  /api/construction/milestones?projectId=xxx  — List milestones for a project
 * POST /api/construction/milestones               — Seed milestones from accepted bid
 * PATCH /api/construction/milestones              — Submit or verify a milestone
 *
 * Milestone lifecycle:
 *   pending → submitted (company uploads evidence) → verified (admin/CAN confirms)
 *                                                  → rejected (admin requests re-submission)
 *
 * On VERIFY:
 *  - Updates milestone status to 'verified'
 *  - Calculates cumulative % of project value verified
 *  - Creates notification for all platform users holding this project's token
 *  - Sends push notification to all subscribed devices
 *  - Writes immutable audit log entry
 *
 * Milestone value steps (per document specification):
 *   Foundation complete       → 20% value unlocked
 *   Structure complete        → 40% unlocked
 *   Roof & envelope complete  → 60% unlocked
 *   Finishing complete        → 80% unlocked
 *   UDA completion cert       → 100% unlocked
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, createNotification } from '@/lib/db';
import { authenticateRequest, isAdmin } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { jsonError } from '@/lib/api-response';

// ── GET — List milestones for a project ───────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await authenticateRequest(request);
  if (!user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');

  const projectId = request.nextUrl.searchParams.get('projectId');
  if (!projectId) return jsonError('projectId is required', 400, 'VALIDATION_ERROR');

  const db = await getDb();

  const milestones = await db
    .prepare(
      `SELECT m.*,
              sv.name AS submitted_by_name,
              vv.name AS verified_by_name
       FROM construction_milestones m
       LEFT JOIN users sv ON sv.id = m.submitted_by
       LEFT JOIN users vv ON vv.id = m.verified_by
       WHERE m.project_id = ?
       ORDER BY m.sort_order ASC`
    )
    .all(projectId);

  const progress = await db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status = 'verified') AS verified,
         COALESCE(SUM(pct_value) FILTER (WHERE status = 'verified'), 0) AS pct_complete
       FROM construction_milestones
       WHERE project_id = ?`
    )
    .get(projectId) as { total: number; verified: number; pct_complete: number } | undefined;

  return NextResponse.json({
    milestones,
    progress: {
      total:        progress?.total        ?? 0,
      verified:     progress?.verified     ?? 0,
      pct_complete: progress?.pct_complete ?? 0,
    },
  });
}

// ── POST — Seed milestones from accepted bid's milestone schedule ──────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await authenticateRequest(request);
  if (!user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return jsonError('Invalid body', 400, 'BAD_REQUEST'); }

  const projectId = typeof body.projectId === 'string' ? body.projectId : '';
  const bidId     = typeof body.bidId     === 'string' ? body.bidId     : '';

  if (!projectId || !bidId) {
    return jsonError('projectId and bidId are required', 400, 'VALIDATION_ERROR');
  }

  const db = await getDb();

  // Verify caller is owner of the project or admin
  const project = await db
    .prepare('SELECT owner_id FROM construction_projects WHERE id = ?')
    .get(projectId) as { owner_id: string } | undefined;

  if (!project) return jsonError('Project not found', 404, 'NOT_FOUND');
  if (project.owner_id !== String(user.id) && !isAdmin(user)) {
    return jsonError('Only the project owner can seed milestones', 403, 'FORBIDDEN');
  }

  // Fetch the accepted bid's milestone schedule
  const bid = await db
    .prepare('SELECT milestone_schedule_json FROM construction_bids WHERE id = ? AND project_id = ?')
    .get(bidId, projectId) as { milestone_schedule_json: string } | undefined;

  if (!bid) return jsonError('Bid not found', 404, 'NOT_FOUND');

  // Check no milestones already seeded
  const existing = await db
    .prepare('SELECT COUNT(*) as c FROM construction_milestones WHERE project_id = ?')
    .get(projectId) as { c: number };
  if (existing.c > 0) {
    return NextResponse.json({
      skipped: true,
      message: `${existing.c} milestones already seeded for this project.`,
      count: existing.c,
    });
  }

  // Parse milestone schedule from bid
  let phases: { name: string; milestone_pct?: number; pct_value?: number }[] = [];
  try {
    const parsed = JSON.parse(bid.milestone_schedule_json);
    phases = parsed.phases ?? parsed; // Support both full timeline and array
  } catch {
    // Fallback to standard 5-phase milestone schedule
    phases = [
      { name: 'Foundation Complete',      milestone_pct: 20 },
      { name: 'Structure Complete',       milestone_pct: 20 },
      { name: 'Roof & Envelope Complete', milestone_pct: 20 },
      { name: 'Finishing Complete',       milestone_pct: 20 },
      { name: 'UDA Completion Certificate', milestone_pct: 20 },
    ];
  }

  const ids: string[] = [];
  for (let i = 0; i < phases.length; i++) {
    const p   = phases[i];
    const id  = uuidv4();
    const pct = p.milestone_pct ?? p.pct_value ?? 20;
    await db
      .prepare(
        `INSERT INTO construction_milestones
           (id, project_id, bid_id, name, pct_value, sort_order, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`
      )
      .run(id, projectId, bidId, p.name, pct, i);
    ids.push(id);
  }

  await writeAuditLog('milestones_seeded', String(user.id), {
    targetId:   projectId,
    targetType: 'construction_project',
    details:    { bidId, count: ids.length },
  });

  return NextResponse.json({ success: true, count: ids.length, ids }, { status: 201 });
}

// ── PATCH — Submit or verify a milestone ──────────────────────────────────────

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const user = await authenticateRequest(request);
  if (!user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return jsonError('Invalid body', 400, 'BAD_REQUEST'); }

  const milestoneId = typeof body.milestoneId === 'string' ? body.milestoneId.trim() : '';
  const action      = typeof body.action      === 'string' ? body.action.trim()      : '';
  const evidence    = typeof body.evidence    === 'string' ? body.evidence           : undefined;
  const notes       = typeof body.notes       === 'string' ? body.notes              : undefined;
  const reason      = typeof body.reason      === 'string' ? body.reason             : undefined;

  if (!milestoneId) return jsonError('milestoneId is required', 400, 'VALIDATION_ERROR');
  if (!['submit', 'verify', 'reject'].includes(action)) {
    return jsonError('action must be: submit | verify | reject', 400, 'VALIDATION_ERROR');
  }

  const db = await getDb();

  // Load milestone with project info
  const row = await db
    .prepare(
      `SELECT m.*,
              p.owner_id, p.title AS project_title, p.token_minted,
              b.company_id
       FROM construction_milestones m
       JOIN construction_projects p ON p.id = m.project_id
       JOIN construction_bids     b ON b.id = m.bid_id
       WHERE m.id = ?`
    )
    .get(milestoneId) as {
      id:              string;
      project_id:      string;
      name:            string;
      pct_value:       number;
      status:          string;
      owner_id:        string;
      project_title:   string;
      token_minted:    number;
      company_id:      string;
    } | undefined;

  if (!row) return jsonError('Milestone not found', 404, 'NOT_FOUND');

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  // ── SUBMIT (construction company submits completion evidence) ─────────────
  if (action === 'submit') {
    if (row.status !== 'pending') {
      return jsonError(`Milestone is already ${row.status}`, 409, 'CONFLICT');
    }

    await db
      .prepare(
        `UPDATE construction_milestones
         SET status = 'submitted', submitted_at = datetime('now'),
             submitted_by = ?, evidence_json = ?
         WHERE id = ?`
      )
      .run(String(user.id), evidence ?? null, milestoneId);

    // Notify project owner
    createNotification(
      row.owner_id,
      'Milestone Submitted',
      `"${row.name}" for ${row.project_title} has been submitted for verification.`,
      'system',
      `/construction/${row.project_id}`
    ).catch(() => {});

    // Notify admins
    const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').filter(Boolean);
    if (adminEmails.length > 0) {
      // Email admin - fire and forget
      import('@/lib/email').then(async () => {
        // Use Resend directly for admin milestone alert
        try {
          const { Resend } = await import('resend');
          const key = process.env.RESEND_API_KEY;
          if (!key) return;
          const FROM = process.env.EMAIL_FROM ?? 'Tokenly Build <noreply@tokenly.luxury>';
          const r = new Resend(key);
          await r.emails.send({
            from: FROM, to: adminEmails,
            subject: `[VERIFY REQUIRED] Milestone: ${row.name} — ${row.project_title}`,
            html: `<p>A construction milestone has been submitted and requires CAN/admin verification.</p>
                   <p><strong>Project:</strong> ${row.project_title}</p>
                   <p><strong>Milestone:</strong> ${row.name} (${row.pct_value}% value)</p>
                   <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin">Open Admin Panel</a></p>`,
          });
        } catch { /* non-fatal */ }
      }).catch(() => {});
    }

    await writeAuditLog('milestone_submitted', String(user.id), {
      targetId: milestoneId, targetType: 'construction_milestone',
      details: { projectId: row.project_id, name: row.name, pct_value: row.pct_value },
      ipAddress: ip,
    });

    return NextResponse.json({ success: true, message: `Milestone "${row.name}" submitted for verification.` });
  }

  // ── VERIFY / REJECT (admin or CAN) ────────────────────────────────────────
  if (!isAdmin(user)) return jsonError('Admin or CAN access required to verify milestones', 403, 'FORBIDDEN');

  if (action === 'verify') {
    if (row.status !== 'submitted') {
      return jsonError(`Milestone must be submitted before verification (current: ${row.status})`, 409, 'CONFLICT');
    }

    await db.transaction(async (txDb) => {
      await txDb
        .prepare(
          `UPDATE construction_milestones
           SET status = 'verified', verified_at = datetime('now'), verified_by = ?, notes = ?
           WHERE id = ?`
        )
        .run(String(user.id), notes ?? null, milestoneId);
    });

    // Calculate cumulative % complete
    const progress = await db
      .prepare(
        `SELECT COALESCE(SUM(pct_value), 0) AS pct_complete
         FROM construction_milestones
         WHERE project_id = ? AND status = 'verified'`
      )
      .get(row.project_id) as { pct_complete: number };

    const pctComplete = progress.pct_complete;

    // Notify project owner
    createNotification(
      row.owner_id,
      'Milestone Verified ✓',
      `"${row.name}" has been verified by a CAN auditor. Project is ${pctComplete}% complete.`,
      'system',
      `/construction/${row.project_id}`
    ).catch(() => {});

    // Notify all token holders if project is tokenized
    if (row.token_minted) {
      const holders = await db
        .prepare(
          `SELECT DISTINCT user_id FROM user_shares
           WHERE product_id = ? AND shares > 0`
        )
        .all(row.project_id) as { user_id: string }[];

      for (const holder of holders) {
        if (holder.user_id === row.owner_id) continue; // already notified above
        createNotification(
          holder.user_id,
          'Construction Milestone Verified',
          `${row.project_title}: "${row.name}" verified. Project ${pctComplete}% complete. Token value stepped up.`,
          'trade',
          `/construction/${row.project_id}`
        ).catch(() => {});
      }
    }

    await writeAuditLog('milestone_verified', String(user.id), {
      targetId: milestoneId, targetType: 'construction_milestone',
      details: { projectId: row.project_id, name: row.name, pct_value: row.pct_value, pct_complete: pctComplete },
      ipAddress: ip,
    });

    return NextResponse.json({
      success:      true,
      message:      `Milestone "${row.name}" verified. Project ${pctComplete}% complete.`,
      pctComplete,
    });
  }

  if (action === 'reject') {
    await db
      .prepare(
        `UPDATE construction_milestones
         SET status = 'pending', submitted_at = NULL, submitted_by = NULL,
             rejection_reason = ?, notes = ?
         WHERE id = ?`
      )
      .run(reason ?? 'Rejected by admin', notes ?? null, milestoneId);

    // Notify company (via project owner for now)
    createNotification(
      row.owner_id,
      'Milestone Rejected',
      `"${row.name}" was rejected. ${reason ? `Reason: ${reason}` : 'Resubmit with correct evidence.'}`,
      'system',
      `/construction/${row.project_id}`
    ).catch(() => {});

    await writeAuditLog('milestone_rejected', String(user.id), {
      targetId: milestoneId, targetType: 'construction_milestone',
      details: { projectId: row.project_id, name: row.name, reason },
      ipAddress: ip,
    });

    return NextResponse.json({ success: true, message: `Milestone "${row.name}" sent back for resubmission.` });
  }

  return jsonError('Unknown action', 400, 'BAD_REQUEST');
}
