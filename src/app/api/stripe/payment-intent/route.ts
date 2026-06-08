/**
 * POST /api/stripe/payment-intent
 *
 * Creates a Stripe PaymentIntent for a USD deposit and records it in the
 * stripe_payments table with status='pending'. Returns the clientSecret
 * required by Stripe Elements on the client.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY=sk_live_xxxxx   (from Stripe dashboard)
 *
 * Install: npm install stripe
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit-request';
import { jsonError } from '@/lib/api-response';

// Singleton Stripe client
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('[STRIPE] STRIPE_SECRET_KEY is not configured.');
  if (!_stripe) _stripe = new Stripe(key, { apiVersion: '2024-06-20' as any, typescript: true });
  return _stripe;
}

// USD → PTS conversion: $1 = 100 PTS
const PTS_PER_DOLLAR = 100;
const MIN_USD = 5;
const MAX_USD = 50_000;

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Rate limit: 10 requests per user per 5 min ──────────────────────────────
  const rl = await enforceRateLimit(request, 'stripe:pi', 10, 300);
  if (rl) return rl;

  // ── Auth ────────────────────────────────────────────────────────────────────
  const user = await authenticateRequest(request);
  if (!user) return jsonError('You must be signed in to make a deposit.', 401, 'UNAUTHORIZED');

  // ── Parse + validate body ───────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body', 400, 'BAD_REQUEST');
  }

  const amountUSD = Number(body.amountUSD);
  if (!Number.isFinite(amountUSD) || amountUSD < MIN_USD || amountUSD > MAX_USD) {
    return jsonError(
      `Amount must be between $${MIN_USD} and $${MAX_USD.toLocaleString()} USD.`,
      400,
      'VALIDATION_ERROR'
    );
  }

  // Round to 2 dp to avoid floating-point surprises
  const amountUSDRounded   = Math.round(amountUSD * 100) / 100;
  const amountCents        = Math.round(amountUSDRounded * 100); // Stripe uses smallest currency unit
  const pointsToGrant      = Math.round(amountUSDRounded * PTS_PER_DOLLAR);

  try {
    const stripe = getStripe();

    // ── Create Stripe PaymentIntent ─────────────────────────────────────────
    const intent = await stripe.paymentIntents.create({
      amount:   amountCents,
      currency: 'usd',
      metadata: {
        user_id:       String(user.id),
        user_email:    String(user.email),
        points_grant:  String(pointsToGrant),
        platform:      'tokenly',
      },
      description: `Tokenly Protocol — ${pointsToGrant.toLocaleString()} PTS for ${user.email}`,
      // Allow card payments. Expand to payment_method_options for more control.
      automatic_payment_methods: { enabled: true },
    });

    // ── Record in DB for idempotency tracking ─────────────────────────────
    const db = await getDb();
    await db
      .prepare(
        `INSERT INTO stripe_payments
          (payment_intent_id, user_id, amount_usd, points_granted, status)
         VALUES (?, ?, ?, ?, 'pending')`
      )
      .run(intent.id, String(user.id), amountUSDRounded, pointsToGrant);

    return NextResponse.json({
      clientSecret:    intent.client_secret,
      paymentIntentId: intent.id,
      amountUSD:       amountUSDRounded,
      pointsToGrant,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe error';
    console.error('[STRIPE_PI] PaymentIntent creation failed:', msg);

    if (err instanceof Stripe.errors.StripeError) {
      return jsonError(err.message, 402, 'BAD_REQUEST');
    }
    return jsonError('Payment initialisation failed. Please try again.', 500, 'INTERNAL');
  }
}
