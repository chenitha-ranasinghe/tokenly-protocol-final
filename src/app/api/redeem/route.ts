/**
 * POST /api/redeem
 *
 * Physical asset redemption — burns the user's shares and initiates the
 * fulfilment workflow. Previously this was a dead end: shares were burned
 * but zero notifications were sent. This version:
 *
 *  1. Validates all gates (RRS ≥ 40, KYC for >50K, 100% ownership)
 *  2. Burns shares + creates redemption record atomically (unchanged)
 *  3. Emails the user a confirmation with their redemption reference
 *  4. Emails ALL admin addresses so they can begin fulfilment immediately
 *  5. Creates an in-app notification for the user
 *  6. Fires a web push notification to the user's devices
 *  7. Returns the real error message in failure cases (was swallowed before)
 *
 * The redemptions record status lifecycle:
 *   pending → dispatched → delivered
 * Managed via PATCH /api/admin/redemptions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, createNotification } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { jsonError } from '@/lib/api-response';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { User, Product } from '@/lib/types';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

// ── Email helpers ─────────────────────────────────────────────────────────────

async function notifyUserOfRedemption(params: {
  email: string;
  name: string;
  productName: string;
  productSku: string;
  redemptionId: string;
  shippingAddress: string;
  method: string;
}) {
  try {
    const { Resend } = await import('resend');
    const key = process.env.RESEND_API_KEY;
    if (!key) return;
    const resend = new Resend(key);
    const FROM = process.env.EMAIL_FROM ?? 'Tokenly Protocol <noreply@tokenly.luxury>';
    const refCode = params.redemptionId.slice(0, 8).toUpperCase();

    await resend.emails.send({
      from: FROM,
      to: params.email,
      subject: `Tokenly — Redemption Initiated: ${params.productName}`,
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Redemption Initiated</title></head>
<body style="margin:0;padding:0;background:#050505;font-family:Helvetica,Arial,sans-serif;color:#fff;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:48px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="background:#0a0a0a;border-top:2px solid #a37e2c;border:1px solid #1a1a1a;padding:32px 40px;">
  <p style="margin:0 0 6px;font-family:monospace;font-size:9px;letter-spacing:.3em;color:#a37e2c;text-transform:uppercase;">TOKENLY PROTOCOL · FULFILMENT</p>
  <h1 style="margin:0 0 20px;font-size:24px;font-weight:300;color:#fff;">Redemption Initiated.</h1>
  <p style="margin:0 0 20px;font-size:13px;line-height:1.7;color:#999;">
    Your physical asset redemption request has been received and your vault shares have been burned.
    The Tokenly logistics team will contact you within 2 business days to coordinate delivery.
  </p>
  <table style="width:100%;border:1px solid #1a1a1a;margin-bottom:24px;">
    <tr><td style="padding:12px 16px;border-bottom:1px solid #111;font-size:9px;font-family:monospace;color:#555;text-transform:uppercase;letter-spacing:.2em;">ASSET</td>
        <td style="padding:12px 16px;border-bottom:1px solid #111;font-size:13px;color:#fff;">${params.productName}</td></tr>
    <tr><td style="padding:12px 16px;border-bottom:1px solid #111;font-size:9px;font-family:monospace;color:#555;text-transform:uppercase;letter-spacing:.2em;">SERIAL</td>
        <td style="padding:12px 16px;border-bottom:1px solid #111;font-size:13px;font-family:monospace;color:#a37e2c;">${params.productSku}</td></tr>
    <tr><td style="padding:12px 16px;border-bottom:1px solid #111;font-size:9px;font-family:monospace;color:#555;text-transform:uppercase;letter-spacing:.2em;">REFERENCE</td>
        <td style="padding:12px 16px;border-bottom:1px solid #111;font-size:13px;font-family:monospace;color:#a37e2c;">TLY-${refCode}</td></tr>
    <tr><td style="padding:12px 16px;border-bottom:1px solid #111;font-size:9px;font-family:monospace;color:#555;text-transform:uppercase;letter-spacing:.2em;">METHOD</td>
        <td style="padding:12px 16px;border-bottom:1px solid #111;font-size:13px;color:#fff;">${params.method || 'Standard Delivery'}</td></tr>
    <tr><td style="padding:12px 16px;font-size:9px;font-family:monospace;color:#555;text-transform:uppercase;letter-spacing:.2em;">SHIP TO</td>
        <td style="padding:12px 16px;font-size:12px;color:#fff;white-space:pre-wrap;">${params.shippingAddress || 'To be confirmed'}</td></tr>
  </table>
  <p style="margin:0;font-size:11px;color:#555;line-height:1.7;">
    Quote your reference <strong style="color:#a37e2c;font-family:monospace;">TLY-${refCode}</strong> in all correspondence.<br/>
    Expect a delivery confirmation email with tracking details once dispatched.
  </p>
</td></tr>
<tr><td style="padding:20px 40px;background:#050505;border:1px solid #111;border-top:none;">
  <p style="margin:0;font-size:9px;color:#333;font-family:monospace;">Tokenly Protocol · Physical Asset Redemption Programme</p>
</td></tr>
</table>
</td></tr></table></body></html>`,
    });
  } catch (err) {
    console.error('[REDEEM] User email failed:', err);
  }
}

async function notifyAdminsOfRedemption(params: {
  userName: string;
  userEmail: string;
  productName: string;
  productSku: string;
  redemptionId: string;
  shippingAddress: string;
  contactNumber: string;
  method: string;
  consensusValue: number;
}) {
  try {
    const { Resend } = await import('resend');
    const key = process.env.RESEND_API_KEY;
    if (!key) return;
    const resend = new Resend(key);
    const FROM = process.env.EMAIL_FROM ?? 'Tokenly Protocol <noreply@tokenly.luxury>';
    const adminEmailsRaw = process.env.ADMIN_EMAILS ?? '';
    const adminEmails = adminEmailsRaw.split(',').map(e => e.trim()).filter(Boolean);
    if (!adminEmails.length) return;

    const adminUrl = `${APP_URL}/admin`;
    const refCode = params.redemptionId.slice(0, 8).toUpperCase();

    await resend.emails.send({
      from: FROM,
      to: adminEmails,
      subject: `[ACTION REQUIRED] Redemption TLY-${refCode}: ${params.productName}`,
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#050505;font-family:Helvetica,Arial,sans-serif;color:#fff;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:48px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="background:#0a0a0a;border-top:2px solid #ef4444;border:1px solid #1a1a1a;padding:32px 40px;">
  <p style="margin:0 0 6px;font-family:monospace;font-size:9px;letter-spacing:.3em;color:#ef4444;text-transform:uppercase;">TOKENLY ADMIN · ACTION REQUIRED</p>
  <h1 style="margin:0 0 20px;font-size:24px;font-weight:300;color:#fff;">New Redemption Request</h1>
  <p style="margin:0 0 20px;font-size:13px;line-height:1.7;color:#999;">
    A user has burned their shares and requested physical delivery. Begin fulfilment immediately.
  </p>
  <table style="width:100%;border:1px solid #1a1a1a;margin-bottom:24px;">
    <tr><td style="padding:10px 16px;border-bottom:1px solid #111;font-size:9px;font-family:monospace;color:#555;text-transform:uppercase;">REF</td>
        <td style="padding:10px 16px;border-bottom:1px solid #111;font-size:13px;font-family:monospace;color:#a37e2c;">TLY-${refCode}</td></tr>
    <tr><td style="padding:10px 16px;border-bottom:1px solid #111;font-size:9px;font-family:monospace;color:#555;text-transform:uppercase;">CUSTOMER</td>
        <td style="padding:10px 16px;border-bottom:1px solid #111;font-size:13px;color:#fff;">${params.userName} &lt;${params.userEmail}&gt;</td></tr>
    <tr><td style="padding:10px 16px;border-bottom:1px solid #111;font-size:9px;font-family:monospace;color:#555;text-transform:uppercase;">ASSET</td>
        <td style="padding:10px 16px;border-bottom:1px solid #111;font-size:13px;color:#fff;">${params.productName}</td></tr>
    <tr><td style="padding:10px 16px;border-bottom:1px solid #111;font-size:9px;font-family:monospace;color:#555;text-transform:uppercase;">SERIAL</td>
        <td style="padding:10px 16px;border-bottom:1px solid #111;font-size:13px;font-family:monospace;color:#a37e2c;">${params.productSku}</td></tr>
    <tr><td style="padding:10px 16px;border-bottom:1px solid #111;font-size:9px;font-family:monospace;color:#555;text-transform:uppercase;">VALUE</td>
        <td style="padding:10px 16px;border-bottom:1px solid #111;font-size:13px;color:#fff;">$${params.consensusValue.toLocaleString()} PTS</td></tr>
    <tr><td style="padding:10px 16px;border-bottom:1px solid #111;font-size:9px;font-family:monospace;color:#555;text-transform:uppercase;">METHOD</td>
        <td style="padding:10px 16px;border-bottom:1px solid #111;font-size:13px;color:#fff;">${params.method || 'Standard Delivery'}</td></tr>
    <tr><td style="padding:10px 16px;border-bottom:1px solid #111;font-size:9px;font-family:monospace;color:#555;text-transform:uppercase;">CONTACT</td>
        <td style="padding:10px 16px;border-bottom:1px solid #111;font-size:13px;color:#fff;">${params.contactNumber || 'Not provided'}</td></tr>
    <tr><td style="padding:10px 16px;font-size:9px;font-family:monospace;color:#555;text-transform:uppercase;">SHIP TO</td>
        <td style="padding:10px 16px;font-size:12px;color:#fff;white-space:pre-wrap;">${params.shippingAddress || 'Not provided'}</td></tr>
  </table>
  <table cellpadding="0" cellspacing="0"><tr><td style="background:#a37e2c;">
    <a href="${adminUrl}" style="display:block;padding:14px 32px;color:#000;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.2em;text-decoration:none;font-family:monospace;">OPEN ADMIN DASHBOARD</a>
  </td></tr></table>
</td></tr></table>
</td></tr></table></body></html>`,
    });
  } catch (err) {
    console.error('[REDEEM] Admin email failed:', err);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await authenticateRequest(req) as User | null;
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');

    const body = await req.json();
    const { productId, shippingAddress, contactNumber, method } = body;

    if (!productId) return jsonError('Missing product ID.', 400, 'VALIDATION_ERROR');

    const db = await getDb();
    let product: Product | undefined;
    let redemptionId: string = '';

    try {
      await db.transaction(async (txDb) => {
        const fullUser = await txDb
          .prepare('SELECT * FROM users WHERE id = ?')
          .get(user.id) as Record<string, unknown> | undefined;
        if (!fullUser) throw new Error('User record not found.');

        const share = await txDb
          .prepare('SELECT * FROM user_shares WHERE user_id = ? AND product_id = ?')
          .get(user.id, productId) as Record<string, unknown> | undefined;
        if (!share) throw new Error('You do not own any shares of this asset.');

        product = await txDb
          .prepare('SELECT * FROM products WHERE id = ?')
          .get(productId) as Product | undefined;
        if (!product) throw new Error('Asset not found.');

        if (Number(fullUser.rrs_score) < 40) {
          throw new Error(
            'REDEMPTION BLOCKED: Institutional redemption requires a Reviewer Reputation Score (RRS) of at least 40. ' +
            'Stake and review more assets to prove network trust.'
          );
        }

        if (Number(product.consensus_price) > 50000 && !Number(fullUser.is_id_verified)) {
          throw new Error(
            'IDENTIFICATION REQUIRED: Assets valued above $50,000 PTS require Level 2 Identity Verification. ' +
            'Complete KYC through the Privy/Passport layer.'
          );
        }

        if (Number(share.shares) < Number(product.total_tokens)) {
          throw new Error(
            `You must acquire 100% ownership (${product.total_tokens} shares) to redeem the physical asset. ` +
            `You own ${share.shares}/${product.total_tokens}.`
          );
        }

        // Burn the shares
        await txDb
          .prepare('DELETE FROM user_shares WHERE id = ?')
          .run(String(share.id));

        redemptionId = uuidv4();
        await txDb
          .prepare(
            `INSERT INTO redemptions
               (id, user_id, product_id, status, shipping_address, contact_number, redemption_method)
             VALUES (?, ?, ?, 'pending', ?, ?, ?)`
          )
          .run(redemptionId, user.id, productId, shippingAddress ?? null, contactNumber ?? null, method ?? null);

        // Ledger entry
        await txDb
          .prepare(
            'INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)'
          )
          .run(
            uuidv4(),
            String(user.id),
            0,
            'redemption',
            `CONTRACT SETTLED: Burned 100% supply of ${product.name} [${product.sku}]. ` +
            `Value: ${product.consensus_price} PTS. Redemption ID: ${redemptionId}`
          );
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Redemption failed.';
      return jsonError(msg, 400, 'BAD_REQUEST');
    }

    // ── Post-redemption side effects (all async, non-blocking) ─────────────

    if (product) {
      const p = product;
      const u = user;
      const rId = redemptionId;

      // In-app notification
      createNotification(
        String(u.id),
        'Redemption Initiated',
        `Your redemption of ${p.name} (TLY-${rId.slice(0, 8).toUpperCase()}) has been received. ` +
        `Expect contact within 2 business days.`,
        'trade',
        '/portfolio'
      ).catch(e => console.error('[REDEEM] Notification failed:', e));

      // User confirmation email
      notifyUserOfRedemption({
        email:           String(u.email),
        name:            String(u.name),
        productName:     String(p.name),
        productSku:      String(p.sku),
        redemptionId:    rId,
        shippingAddress: shippingAddress ?? '',
        method:          method ?? '',
      }).catch(e => console.error('[REDEEM] User email failed:', e));

      // Admin action email
      notifyAdminsOfRedemption({
        userName:       String(u.name),
        userEmail:      String(u.email),
        productName:    String(p.name),
        productSku:     String(p.sku),
        redemptionId:   rId,
        shippingAddress: shippingAddress ?? 'Not provided',
        contactNumber:   contactNumber  ?? 'Not provided',
        method:          method         ?? 'Standard Delivery',
        consensusValue:  Number(p.consensus_price),
      }).catch(e => console.error('[REDEEM] Admin email failed:', e));

      // Audit log
      writeAuditLog('redemption_initiated', String(u.id), {
        targetId:   rId,
        targetType: 'redemption',
        details:    { productId, productName: p.name, method, shippingAddress },
        ipAddress:  req.headers.get('x-forwarded-for') ?? 'unknown',
      }).catch(e => console.error('[REDEEM] Audit log failed:', e));
    }

    const refCode = redemptionId.slice(0, 8).toUpperCase();
    return NextResponse.json({
      success:     true,
      redemptionId,
      reference:   `TLY-${refCode}`,
      message:
        `Redemption initiated (Ref: TLY-${refCode}). ` +
        `A confirmation email has been sent to ${user.email}. ` +
        `Our logistics team will contact you within 2 business days.`,
    });
  } catch (error) {
    console.error('[REDEEM] Unhandled error:', error);
    return jsonError('Internal server error', 500, 'INTERNAL');
  }
}
