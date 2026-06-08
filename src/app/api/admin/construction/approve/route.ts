/**
 * POST /api/admin/construction/approve
 *
 * Admin-only endpoint to approve or reject a construction project's legal gate.
 * This is the missing wire for `canOpenPublicBidding` — once approved here,
 * the project's `legal_status` becomes 'approved' and public bidding opens.
 *
 * Approval actions:
 *  - 'approve'  → legal_status = 'approved', status = 'approved', bidding can open
 *  - 'reject'   → legal_status = 'rejected', status = 'draft' (owner must re-submit)
 *  - 'open_bidding' → confirms bidding is open (requires prior approval)
 *  - 'close_bidding' → closes bidding, moves to status = 'awarded'
 *
 * On any state change, the project owner receives an in-app notification
 * and an email (via Resend).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, createNotification } from '@/lib/db';
import { authenticateRequest, isAdmin } from '@/lib/session';
import { jsonError } from '@/lib/api-response';
import { writeAuditLog } from '@/lib/audit';
import { canOpenPublicBidding } from '@/lib/legal-gate';

type Action = 'approve' | 'reject' | 'open_bidding' | 'close_bidding';

interface ProjectRow {
  id:                  string;
  owner_id:            string;
  title:               string;
  status:              string;
  legal_status:        string;
  approval_doc_hash:   string | null;
  district:            string;
}

interface OwnerRow {
  id:    string;
  email: string;
  name:  string;
}

// Map of actions to human-readable notifications for the owner
const OWNER_NOTIFICATIONS: Record<Action, (title: string, reason?: string) => { title: string; body: string }> = {
  approve: (t) => ({
    title: 'Project Approved',
    body:  `Your construction project "${t}" has been legally approved. You may now open public bidding for contractors.`,
  }),
  reject: (t, r) => ({
    title: 'Project Requires Revision',
    body:  `Your project "${t}" requires changes before approval. ${r ? 'Reason: ' + r : 'Contact the review team for details.'}`,
  }),
  open_bidding: (t) => ({
    title: 'Public Bidding Opened',
    body:  `Public bidding for "${t}" is now open. Registered contractors can submit bids.`,
  }),
  close_bidding: (t) => ({
    title: 'Bidding Closed',
    body:  `Bidding has closed for "${t}". Review submitted bids and select a winning contractor.`,
  }),
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Admin auth ─────────────────────────────────────────────────────────────
  const user = await authenticateRequest(request);
  if (!user || !isAdmin(user)) {
    return jsonError('Admin access required.', 401, 'UNAUTHORIZED');
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body.', 400, 'BAD_REQUEST');
  }

  const projectId      = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const action         = typeof body.action    === 'string' ? body.action.trim() as Action : '' as Action;
  const reason         = typeof body.reason    === 'string' ? body.reason.trim() : undefined;
  const approvalDocRef = typeof body.approvalDocRef === 'string' ? body.approvalDocRef.trim() : undefined;

  if (!projectId) return jsonError('projectId is required.', 400, 'VALIDATION_ERROR');

  const validActions: Action[] = ['approve', 'reject', 'open_bidding', 'close_bidding'];
  if (!validActions.includes(action)) {
    return jsonError(
      `Invalid action "${action}". Must be one of: ${validActions.join(', ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }

  const db = await getDb();

  // ── Load project ───────────────────────────────────────────────────────────
  const project = await db
    .prepare('SELECT * FROM construction_projects WHERE id = ?')
    .get(projectId) as ProjectRow | undefined;

  if (!project) {
    return jsonError('Project not found.', 404, 'NOT_FOUND');
  }

  // ── Load owner for notification + email ────────────────────────────────────
  const owner = await db
    .prepare('SELECT id, email, name FROM users WHERE id = ?')
    .get(project.owner_id) as OwnerRow | undefined;

  // ── Apply action ───────────────────────────────────────────────────────────
  let newLegalStatus = project.legal_status;
  let newStatus      = project.status;
  let responseMsg    = '';

  switch (action) {
    case 'approve': {
      if (project.legal_status === 'approved') {
        return jsonError('Project is already approved.', 409, 'CONFLICT');
      }
      newLegalStatus = 'approved';
      newStatus      = 'approved';
      responseMsg    = `Project "${project.title}" approved. Owner can now open public bidding.`;
      break;
    }

    case 'reject': {
      if (project.legal_status === 'rejected') {
        return jsonError('Project is already rejected.', 409, 'CONFLICT');
      }
      newLegalStatus = 'rejected';
      newStatus      = 'draft';  // Push back to draft for re-submission
      responseMsg    = `Project "${project.title}" rejected. Owner notified.`;
      break;
    }

    case 'open_bidding': {
      // Run through the legal gate — same check the owner UI triggers
      const gate = canOpenPublicBidding(project.legal_status as any, project.status);
      if (!gate.allowed) {
        return jsonError(gate.reason ?? 'Cannot open bidding.', 403, 'FORBIDDEN');
      }
      newStatus   = 'bidding';
      responseMsg = `Public bidding opened for "${project.title}".`;
      break;
    }

    case 'close_bidding': {
      if (project.status !== 'bidding') {
        return jsonError(
          `Project is not currently in bidding status (current: ${project.status}).`,
          409,
          'CONFLICT'
        );
      }
      newStatus   = 'reviewing';
      responseMsg = `Bidding closed for "${project.title}". Status: reviewing.`;
      break;
    }
  }

  // ── Update project atomically ──────────────────────────────────────────────
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  await db.transaction(async (txDb) => {
    await txDb
      .prepare(
        `UPDATE construction_projects
         SET legal_status      = ?,
             status            = ?,
             approval_doc_hash = COALESCE(?, approval_doc_hash),
             updated_at        = datetime('now')
         WHERE id = ?`
      )
      .run(newLegalStatus, newStatus, approvalDocRef ?? null, projectId);

    // Write immutable audit trail
    await writeAuditLog(`construction_${action}`, String(user.id), {
      targetId:   projectId,
      targetType: 'construction_project',
      details: {
        previousLegalStatus: project.legal_status,
        newLegalStatus,
        previousStatus: project.status,
        newStatus,
        reason,
        approvalDocRef,
        projectTitle: project.title,
        district:     project.district,
      },
      ipAddress: ip,
    });

    // Create in-app notification for owner
    if (owner) {
      const notif = OWNER_NOTIFICATIONS[action](project.title, reason);
      await createNotification(owner.id, notif.title, notif.body, 'system');
    }
  });

  // ── Send email to owner (async, non-blocking) ──────────────────────────────
  if (owner) {
    const notif      = OWNER_NOTIFICATIONS[action](project.title, reason);
    const APP_URL    = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const projectUrl = `${APP_URL}/construction/${projectId}`;

    import('@/lib/email').then(async ({ sendWelcomeEmail: _ }) => {
      // Use Resend directly for a construction-specific template
      const Resend = await import('resend').then(m => m.Resend);
      const key    = process.env.RESEND_API_KEY;
      if (!key) return;

      const resend  = new Resend(key);
      const FROM    = process.env.EMAIL_FROM || 'Tokenly Build <noreply@tokenly.luxury>';
      const subject = `Tokenly Build — ${notif.title}: ${project.title}`;
      const html    = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#050505;font-family:Helvetica,Arial,sans-serif;color:#fff;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:48px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="background:#0a0a0a;border-top:2px solid #a37e2c;border:1px solid #1a1a1a;padding:32px 40px;">
  <p style="margin:0 0 6px;font-family:monospace;font-size:9px;letter-spacing:.3em;color:#a37e2c;text-transform:uppercase;">TOKENLY BUILD · CONSTRUCTION</p>
  <h1 style="margin:0 0 20px;font-size:22px;font-weight:300;color:#fff;">${notif.title}</h1>
  <p style="margin:0 0 24px;font-size:13px;line-height:1.7;color:#999;">${notif.body}</p>
  ${reason ? `<p style="margin:0 0 20px;padding:12px 16px;border-left:2px solid #a37e2c;font-size:12px;color:#777;font-family:monospace;">${reason}</p>` : ''}
  <table cellpadding="0" cellspacing="0"><tr><td style="background:#a37e2c;">
    <a href="${projectUrl}" style="display:block;padding:14px 32px;color:#000;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.2em;text-decoration:none;font-family:monospace;">VIEW PROJECT</a>
  </td></tr></table>
</td></tr>
<tr><td style="padding:16px 40px;background:#050505;border:1px solid #111;border-top:none;">
  <p style="margin:0;font-size:9px;color:#333;font-family:monospace;">Tokenly Build · Construction Intelligence Platform</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

      await resend.emails.send({ from: FROM, to: owner.email, subject, html })
        .catch(err => console.error('[CONSTRUCTION_APPROVE] Email error:', err));
    }).catch(err => console.error('[CONSTRUCTION_APPROVE] Email module error:', err));
  }

  // ── Return updated project ─────────────────────────────────────────────────
  const updated = await db
    .prepare('SELECT * FROM construction_projects WHERE id = ?')
    .get(projectId);

  console.info(`[CONSTRUCTION_APPROVE] Admin ${user.id} → ${action} on project ${projectId}`);

  return NextResponse.json({
    success: true,
    message: responseMsg,
    project: updated,
  });
}

// ── GET — List projects pending approval ───────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await authenticateRequest(request);
  if (!user || !isAdmin(user)) {
    return jsonError('Admin access required.', 401, 'UNAUTHORIZED');
  }

  const db = await getDb();

  // Return projects that need admin attention
  const pending = await db
    .prepare(
      `SELECT p.*, u.email as owner_email, u.name as owner_name,
              COUNT(b.id) as bid_count
       FROM construction_projects p
       LEFT JOIN users u ON u.id = p.owner_id
       LEFT JOIN construction_bids b ON b.project_id = p.id
       WHERE p.legal_status IN ('none', 'pending', 'rejected')
          OR p.status IN ('draft', 'approved', 'bidding')
       GROUP BY p.id
       ORDER BY p.updated_at DESC
       LIMIT 50`
    )
    .all();

  const stats = await db
    .prepare(
      `SELECT
         COUNT(*) FILTER (WHERE legal_status = 'none')     as awaiting_review,
         COUNT(*) FILTER (WHERE legal_status = 'pending')  as under_review,
         COUNT(*) FILTER (WHERE legal_status = 'approved') as approved,
         COUNT(*) FILTER (WHERE legal_status = 'rejected') as rejected,
         COUNT(*) FILTER (WHERE status = 'bidding')        as active_bidding
       FROM construction_projects`
    )
    .get();

  return NextResponse.json({ projects: pending, stats });
}
