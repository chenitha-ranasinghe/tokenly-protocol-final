/**
 * POST /api/stripe/verify
 *
 * Called by the client immediately after Stripe confirms a successful payment.
 * Retrieves the PaymentIntent directly from Stripe, verifies it succeeded,
 * and grants the corresponding protocol points — idempotent (safe to call twice).
 *
 * The Stripe webhook (/api/stripe/webhook) is a secondary safety net that
 * catches any payments where the client-side call was interrupted (e.g. tab
 * closed before this endpoint was reached).
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit-request';
import { jsonError } from '@/lib/api-response';
import { sendDepositConfirmation } from '@/lib/email';

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('[STRIPE] STRIPE_SECRET_KEY is not configured.');
  if (!_stripe) _stripe = new Stripe(key, { apiVersion: '2024-06-20' as any, typescript: true });
  return _stripe;
}

const SAFE_FIELDS =
  'id, email, name, wallet_address, points, experiment_group, total_reviews, accurate_reviews, rrs_score, created_at, is_admin, is_id_verified';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Rate limit: 20 per user per 5 min (slightly generous for verify retries) ─
  const rl = await enforceRateLimit(request, 'stripe:verify', 20, 300);
  if (rl) return rl;

  // ── Auth ────────────────────────────────────────────────────────────────────
  const user = await authenticateRequest(request);
  if (!user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body', 400, 'BAD_REQUEST');
  }

  const paymentIntentId = typeof body.paymentIntentId === 'string'
    ? body.paymentIntentId.trim()
    : '';

  if (!paymentIntentId.startsWith('pi_')) {
    return jsonError('Invalid payment intent ID.', 400, 'VALIDATION_ERROR');
  }

  const db = await getDb();

  try {
    // ── Retrieve PaymentIntent from Stripe (source of truth) ─────────────────
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // ── Security: ensure this PI belongs to this user ─────────────────────────
    if (intent.metadata?.user_id !== String(user.id)) {
      return jsonError('This payment does not belong to your account.', 403, 'FORBIDDEN');
    }

    if (intent.status !== 'succeeded') {
      return jsonError(
        `Payment has not succeeded yet (status: ${intent.status}).`,
        402,
        'BAD_REQUEST'
      );
    }

    // ── Idempotency check — look up our DB record ─────────────────────────────
    const existingRecord = await db
      .prepare("SELECT * FROM stripe_payments WHERE payment_intent_id = ?")
      .get(paymentIntentId) as {
        payment_intent_id: string;
        user_id: string;
        amount_usd: number;
        points_granted: number;
        status: string;
      } | undefined;

    // Already settled → return current user state (idempotent)
    if (existingRecord?.status === 'succeeded') {
      const currentUser = await db
        .prepare(`SELECT ${SAFE_FIELDS} FROM users WHERE id = ?`)
        .get(String(user.id));
      return NextResponse.json({
        success: true,
        alreadySettled: true,
        message: `Deposit already processed: ${existingRecord.points_granted.toLocaleString()} PTS were credited.`,
        pointsGranted: existingRecord.points_granted,
        amountUSD:     existingRecord.amount_usd,
        user:          currentUser,
      });
    }

    // Derive points from Stripe metadata (set at PaymentIntent creation time)
    const pointsGranted = parseInt(intent.metadata?.points_grant ?? '0', 10);
    const amountUSD     = (intent.amount / 100); // cents → dollars

    if (!pointsGranted || pointsGranted <= 0) {
      console.error('[STRIPE_VERIFY] Missing points_grant metadata on intent:', paymentIntentId);
      return jsonError('Payment metadata missing — contact support with your payment reference.', 500, 'INTERNAL');
    }

    // ── Grant points atomically ───────────────────────────────────────────────
    await db.transaction(async (txDb) => {
      // Credit user balance
      await txDb
        .prepare('UPDATE users SET points = points + ? WHERE id = ?')
        .run(pointsGranted, String(user.id));

      // Write ledger entry
      await txDb
        .prepare(
          'INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)'
        )
        .run(
          uuidv4(),
          String(user.id),
          pointsGranted,
          'stripe_deposit',
          `Stripe USD Deposit — $${amountUSD.toFixed(2)} → ${pointsGranted.toLocaleString()} PTS (PI: ${paymentIntentId})`
        );

      // Mark payment as settled
      await txDb
        .prepare(
          "UPDATE stripe_payments SET status = 'succeeded', settled_at = datetime('now') WHERE payment_intent_id = ?"
        )
        .run(paymentIntentId);
    });

    // ── Fetch updated user ────────────────────────────────────────────────────
    const updatedUser = await db
      .prepare(`SELECT ${SAFE_FIELDS} FROM users WHERE id = ?`)
      .get(String(user.id));

    // ── Confirmation email (async, non-blocking) ──────────────────────────────
    sendDepositConfirmation({
      email:           String(user.email),
      name:            String(user.name),
      amountUSD,
      pointsGranted,
      paymentIntentId,
    }).catch(err => console.error('[STRIPE_VERIFY] Confirmation email failed:', err));

    console.info(
      `[STRIPE_VERIFY] Settled PI ${paymentIntentId} → ${pointsGranted} PTS for user ${user.id}`
    );

    return NextResponse.json({
      success:       true,
      alreadySettled: false,
      message:       `Deposit successful. ${pointsGranted.toLocaleString()} PTS have been credited to your account.`,
      pointsGranted,
      amountUSD,
      user:          updatedUser,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[STRIPE_VERIFY] Error:', msg);

    if (err instanceof Stripe.errors.StripeError) {
      return jsonError('Could not verify payment with Stripe: ' + err.message, 502, 'SERVICE_UNAVAILABLE');
    }
    return jsonError('Verification failed. Please contact support with your payment reference.', 500, 'INTERNAL');
  }
}
