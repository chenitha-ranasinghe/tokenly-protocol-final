/**
 * GET  /api/admin/redemptions   — List all redemptions with filters
 * PATCH /api/admin/redemptions  — Update redemption status + tracking number
 *
 * Status lifecycle: pending → dispatched → delivered → (cancelled)
 *
 * On status change to 'dispatched':
 *  - Emails the customer with their tracking number
 *  - Sends in-app + push notification
 *
 * On status change to 'delivered':
 *  - Emails the customer confirming delivery
 *  - Sends in-app + push notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, createNotification } from '@/lib/db';
import { authenticateRequest, isAdmin } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { jsonError } from '@/lib/api-response';

const APP_URL   = process.env.NEXT_PUBLIC_APP_URL ?? '';
const STATUSES  = ['pending', 'dispatched', 'delivered', 'cancelled'] as const;
type Status = typeof STATUSES[number];

async function requireAdmin(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user || !isAdmin(user)) return null;
  return user;
}

// ── GET — List redemptions ─────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request);
  if (!admin) return jsonError('Admin access required.', 401, 'UNAUTHORIZED');

  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status');
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  const db = await getDb();

  const whereClause = status ? `WHERE r.status = '${status}'` : '';

  const redemptions = await db
    .prepare(
      `SELECT
         r.*,
         u.name    AS user_name,
         u.email   AS user_email,
         p.name    AS product_name,
         p.sku     AS product_sku,
         p.consensus_price,
         p.brand
       FROM redemptions r
       JOIN users    u ON u.id = r.user_id
       JOIN products p ON p.id = r.product_id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset);

  const counts = await db
    .prepare(
      `SELECT status, COUNT(*) as c FROM redemptions GROUP BY status`
    )
    .all() as { status: string; c: number }[];

  const summary = Object.fromEntries(counts.map(r => [r.status, r.c]));

  return NextResponse.json({ redemptions, summary, limit, offset });
}

// ── PATCH — Update redemption status ─────────────────────────────────────────

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request);
  if (!admin) return jsonError('Admin access required.', 401, 'UNAUTHORIZED');

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body.', 400, 'BAD_REQUEST');
  }

  const redemptionId  = typeof body.redemptionId  === 'string' ? body.redemptionId.trim()  : '';
  const newStatus     = typeof body.status        === 'string' ? body.status.trim() as Status : '' as Status;
  const trackingNum   = typeof body.trackingNumber === 'string' ? body.trackingNumber.trim() : undefined;
  const notes         = typeof body.notes         === 'string' ? body.notes.trim()         : undefined;
  const carrier       = typeof body.carrier       === 'string' ? body.carrier.trim()       : undefined;

  if (!redemptionId) return jsonError('redemptionId is required.', 400, 'VALIDATION_ERROR');
  if (!STATUSES.includes(newStatus)) {
    return jsonError(`Invalid status. Must be one of: ${STATUSES.join(', ')}`, 400, 'VALIDATION_ERROR');
  }

  const db = await getDb();

  // Fetch full redemption with user + product info
  const row = await db
    .prepare(
      `SELECT r.*, u.name AS user_name, u.email AS user_email, u.id AS uid,
              p.name AS product_name, p.sku AS product_sku
       FROM redemptions r
       JOIN users    u ON u.id = r.user_id
       JOIN products p ON p.id = r.product_id
       WHERE r.id = ?`
    )
    .get(redemptionId) as {
      id: string;
      uid: string;
      user_name: string;
      user_email: string;
      product_name: string;
      product_sku: string;
      status: string;
      shipping_address: string;
      redemption_method: string;
    } | undefined;

  if (!row) return jsonError('Redemption not found.', 404, 'NOT_FOUND');

  const refCode = redemptionId.slice(0, 8).toUpperCase();

  // Build update query dynamically
  const updates: string[] = [`status = '${newStatus}'`, `updated_at = datetime('now')`];
  const runArgs: (string | null)[] = [];

  if (newStatus === 'dispatched') {
    updates.push(`dispatched_at = datetime('now')`);
    if (trackingNum) updates.push(`tracking_number = ?`), runArgs.push(trackingNum);
    if (carrier)     updates.push(`carrier = ?`),         runArgs.push(carrier);
  }
  if (newStatus === 'delivered') {
    updates.push(`delivered_at = datetime('now')`);
  }
  if (notes) {
    updates.push(`notes = ?`);
    runArgs.push(notes);
  }
  runArgs.push(redemptionId);

  await db
    .prepare(`UPDATE redemptions SET ${updates.join(', ')} WHERE id = ?`)
    .run(...runArgs);

  await writeAuditLog(`redemption_${newStatus}`, String(admin.id), {
    targetId:   redemptionId,
    targetType: 'redemption',
    details:    { newStatus, trackingNum, carrier, notes, previousStatus: row.status },
    ipAddress:  request.headers.get('x-forwarded-for') ?? 'unknown',
  });

  // ── Notify customer ────────────────────────────────────────────────────────

  if (newStatus === 'dispatched') {
    const trackingInfo = trackingNum
      ? `Your tracking number is <strong style="color:#a37e2c;font-family:monospace;">${trackingNum}</strong>${carrier ? ` (${carrier})` : ''}.`
      : 'Tracking details will follow separately.';

    // In-app notification
    createNotification(
      row.uid,
      'Asset Dispatched',
      `Your ${row.product_name} (TLY-${refCode}) has been dispatched. ` +
      (trackingNum ? `Tracking: ${trackingNum}${carrier ? ` via ${carrier}` : ''}.` : 'Tracking details to follow.'),
      'trade',
      '/portfolio'
    ).catch(() => {});

    // Email
    sendStatusEmail({
      email:        row.user_email,
      name:         row.user_name,
      subject:      `Tokenly — Your ${row.product_name} has been dispatched`,
      headline:     'Asset Dispatched.',
      preheader:    `TLY-${refCode}: Your ${row.product_name} is on its way.`,
      body:         `Your physical asset has been dispatched from our secure vault and is on its way to you.<br/><br/>${trackingInfo}`,
      refCode,
      productName:  row.product_name,
      productSku:   row.product_sku,
    }).catch(() => {});
  }

  if (newStatus === 'delivered') {
    createNotification(
      row.uid,
      'Asset Delivered',
      `Your ${row.product_name} (TLY-${refCode}) has been confirmed as delivered. ` +
      `Welcome to physical ownership. Rate your experience in the vault.`,
      'trade',
      '/portfolio'
    ).catch(() => {});

    sendStatusEmail({
      email:       row.user_email,
      name:        row.user_name,
      subject:     `Tokenly — Your ${row.product_name} has been delivered`,
      headline:    'Asset Delivered.',
      preheader:   `TLY-${refCode}: Delivery confirmed.`,
      body:        `Your physical asset has been confirmed as delivered. We hope you enjoy your acquisition.`,
      refCode,
      productName: row.product_name,
      productSku:  row.product_sku,
    }).catch(() => {});
  }

  if (newStatus === 'cancelled') {
    createNotification(
      row.uid,
      'Redemption Cancelled',
      `Your redemption of ${row.product_name} (TLY-${refCode}) has been cancelled. ` +
      (notes ? `Reason: ${notes}` : 'Contact support for details.'),
      'system',
      '/portfolio'
    ).catch(() => {});
  }

  const updated = await db
    .prepare('SELECT * FROM redemptions WHERE id = ?')
    .get(redemptionId);

  return NextResponse.json({
    success: true,
    message: `Redemption TLY-${refCode} updated to ${newStatus}.`,
    redemption: updated,
  });
}

// ── Email helper ──────────────────────────────────────────────────────────────

async function sendStatusEmail(params: {
  email:       string;
  name:        string;
  subject:     string;
  headline:    string;
  preheader:   string;
  body:        string;
  refCode:     string;
  productName: string;
  productSku:  string;
}) {
  try {
    const { Resend } = await import('resend');
    const key = process.env.RESEND_API_KEY;
    if (!key) return;
    const resend = new Resend(key);
    const FROM = process.env.EMAIL_FROM ?? 'Tokenly Protocol <noreply@tokenly.luxury>';

    await resend.emails.send({
      from: FROM,
      to: params.email,
      subject: params.subject,
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>${params.subject}</title></head>
<body style="margin:0;padding:0;background:#050505;font-family:Helvetica,Arial,sans-serif;color:#fff;">
<div style="display:none;max-height:0;overflow:hidden;">${params.preheader}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:48px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="background:#0a0a0a;border-top:2px solid #a37e2c;border:1px solid #1a1a1a;padding:32px 40px;">
  <p style="margin:0 0 6px;font-family:monospace;font-size:9px;letter-spacing:.3em;color:#a37e2c;text-transform:uppercase;">TOKENLY LOGISTICS</p>
  <h1 style="margin:0 0 20px;font-size:24px;font-weight:300;color:#fff;">${params.headline}</h1>
  <p style="margin:0 0 20px;font-size:13px;line-height:1.7;color:#999;">${params.body}</p>
  <table style="width:100%;border:1px solid #1a1a1a;margin-bottom:24px;">
    <tr><td style="padding:10px 16px;border-bottom:1px solid #111;font-size:9px;font-family:monospace;color:#555;text-transform:uppercase;">ASSET</td>
        <td style="padding:10px 16px;border-bottom:1px solid #111;font-size:13px;color:#fff;">${params.productName}</td></tr>
    <tr><td style="padding:10px 16px;border-bottom:1px solid #111;font-size:9px;font-family:monospace;color:#555;text-transform:uppercase;">SERIAL</td>
        <td style="padding:10px 16px;border-bottom:1px solid #111;font-size:13px;font-family:monospace;color:#a37e2c;">${params.productSku}</td></tr>
    <tr><td style="padding:10px 16px;font-size:9px;font-family:monospace;color:#555;text-transform:uppercase;">REF</td>
        <td style="padding:10px 16px;font-size:13px;font-family:monospace;color:#a37e2c;">TLY-${params.refCode}</td></tr>
  </table>
  <table cellpadding="0" cellspacing="0"><tr><td style="background:#a37e2c;">
    <a href="${APP_URL}/portfolio" style="display:block;padding:14px 32px;color:#000;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.2em;text-decoration:none;font-family:monospace;">VIEW PORTFOLIO</a>
  </td></tr></table>
</td></tr>
<tr><td style="padding:20px 40px;background:#050505;border:1px solid #111;border-top:none;">
  <p style="margin:0;font-size:9px;color:#333;font-family:monospace;">Tokenly Protocol · Physical Asset Fulfilment</p>
</td></tr>
</table>
</td></tr></table></body></html>`,
    });
  } catch (err) {
    console.error('[REDEMPTIONS] Status email failed:', err);
  }
}
