/**
 * POST /api/stripe/webhook
 *
 * Stripe's server-to-server webhook endpoint — the reliability safety net.
 * Handles `payment_intent.succeeded` events that the client-side /verify
 * endpoint may have missed (e.g. user closed tab mid-payment).
 *
 * Security:
 *  - Every request is verified against the Stripe-Signature header using
 *    the webhook signing secret (not the API key).
 *  - The raw body must NOT be parsed by Next.js before signature verification.
 *  - Idempotency is enforced via the stripe_payments table.
 *
 * Required env var:
 *   STRIPE_WEBHOOK_SECRET=whsec_xxxxx   (from Stripe Dashboard → Webhooks)
 *
 * Register this URL in Stripe Dashboard:
 *   https://yourdomain.com/api/stripe/webhook
 *   Event: payment_intent.succeeded
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { sendDepositConfirmation } from '@/lib/email';

// ── Stripe client singleton ──────────────────────────────────────────────────
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('[STRIPE_WH] STRIPE_SECRET_KEY is not configured.');
  if (!_stripe) _stripe = new Stripe(key, { apiVersion: '2024-06-20' as any, typescript: true });
  return _stripe;
}

// ── Disable automatic body parsing — REQUIRED for Stripe signature verification ──
// In Next.js App Router, use req.text() to read the raw body.
// No special export config is needed (App Router doesn't auto-parse).

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[STRIPE_WH] STRIPE_WEBHOOK_SECRET is not configured — webhook disabled.');
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 500 });
  }

  // ── Read raw body (must NOT be request.json()) ────────────────────────────
  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    console.warn('[STRIPE_WH] Missing Stripe-Signature header');
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  }

  // ── Verify signature ──────────────────────────────────────────────────────
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[STRIPE_WH] Signature verification failed:', msg);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  // ── Handle events ─────────────────────────────────────────────────────────
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        // Acknowledge all other events without processing
        break;
    }
  } catch (err) {
    console.error(`[STRIPE_WH] Handler error for ${event.type}:`, err);
    // Return 500 so Stripe retries the webhook
    return NextResponse.json({ error: 'Handler failed. Retry expected.' }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

// ─── payment_intent.succeeded ────────────────────────────────────────────────

async function handlePaymentSucceeded(intent: Stripe.PaymentIntent): Promise<void> {
  const db = await getDb();
  const paymentIntentId = intent.id;

  // ── Idempotency: skip if already settled ─────────────────────────────────
  const existing = await db
    .prepare("SELECT status FROM stripe_payments WHERE payment_intent_id = ?")
    .get(paymentIntentId) as { status: string } | undefined;

  if (existing?.status === 'succeeded') {
    console.info(`[STRIPE_WH] PI ${paymentIntentId} already settled — skipping.`);
    return;
  }

  // ── Extract metadata ──────────────────────────────────────────────────────
  const userId       = intent.metadata?.user_id;
  const pointsGrant  = parseInt(intent.metadata?.points_grant ?? '0', 10);
  const amountUSD    = intent.amount / 100;

  if (!userId || !pointsGrant) {
    console.error('[STRIPE_WH] Missing metadata on PI:', paymentIntentId, intent.metadata);
    return; // Can't process without metadata — log and move on
  }

  // ── Fetch user for email ──────────────────────────────────────────────────
  const user = await db
    .prepare('SELECT id, email, name FROM users WHERE id = ?')
    .get(userId) as { id: string; email: string; name: string } | undefined;

  if (!user) {
    console.error(`[STRIPE_WH] User ${userId} not found for PI ${paymentIntentId}`);
    return;
  }

  // ── Grant points atomically ───────────────────────────────────────────────
  await db.transaction(async (txDb) => {
    // Credit balance
    await txDb
      .prepare('UPDATE users SET points = points + ? WHERE id = ?')
      .run(pointsGrant, userId);

    // Ledger entry
    await txDb
      .prepare(
        'INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)'
      )
      .run(
        uuidv4(),
        userId,
        pointsGrant,
        'stripe_deposit_webhook',
        `Stripe Webhook Deposit — $${amountUSD.toFixed(2)} → ${pointsGrant.toLocaleString()} PTS (PI: ${paymentIntentId})`
      );

    // Upsert stripe_payments: handle both cases —
    //  (a) record exists as 'pending' (normal flow)
    //  (b) record doesn't exist (webhook arrived before verify was called)
    if (existing) {
      await txDb
        .prepare(
          "UPDATE stripe_payments SET status = 'succeeded', settled_at = datetime('now') WHERE payment_intent_id = ?"
        )
        .run(paymentIntentId);
    } else {
      await txDb
        .prepare(
          `INSERT INTO stripe_payments
             (payment_intent_id, user_id, amount_usd, points_granted, status, settled_at)
           VALUES (?, ?, ?, ?, 'succeeded', datetime('now'))`
        )
        .run(paymentIntentId, userId, amountUSD, pointsGrant);
    }
  });

  // ── Send confirmation email ───────────────────────────────────────────────
  await sendDepositConfirmation({
    email:           user.email,
    name:            user.name,
    amountUSD,
    pointsGranted:   pointsGrant,
    paymentIntentId,
  }).catch(err => console.error('[STRIPE_WH] Confirmation email failed:', err));

  console.info(
    `[STRIPE_WH] ✓ Settled PI ${paymentIntentId} → ${pointsGrant} PTS for user ${userId} via webhook`
  );
}

// ─── payment_intent.payment_failed ───────────────────────────────────────────

async function handlePaymentFailed(intent: Stripe.PaymentIntent): Promise<void> {
  const db = await getDb();
  const paymentIntentId = intent.id;

  // Update status to failed (if record exists)
  await db
    .prepare(
      "UPDATE stripe_payments SET status = 'failed' WHERE payment_intent_id = ? AND status = 'pending'"
    )
    .run(paymentIntentId);

  console.warn(
    `[STRIPE_WH] Payment failed: ${paymentIntentId} — ${intent.last_payment_error?.message ?? 'Unknown reason'}`
  );
}
