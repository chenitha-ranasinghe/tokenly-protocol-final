'use client';

/**
 * /deposit — Real Stripe Payment Page
 *
 * Flow:
 *  1. User selects USD amount and clicks "Proceed to Secure Payment"
 *  2. POST /api/stripe/payment-intent → receives clientSecret
 *  3. Stripe PaymentElement renders in-page (no redirect)
 *  4. User fills card details and confirms
 *  5. POST /api/stripe/verify → points credited, user state updated
 *
 * Install required packages:
 *   npm install @stripe/stripe-js @stripe/react-stripe-js
 *
 * Required env var:
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
 */

import { useStore } from '@/lib/store';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/client';
import { loadStripe, type StripeElementsOptions } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

// ── Stripe singleton (never re-created) ──────────────────────────────────────
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
);

// ── Constants ────────────────────────────────────────────────────────────────
const AMOUNTS   = [10, 50, 100, 500];
const MIN_USD   = 5;
const MAX_USD   = 50_000;

// ─── Inner form (must be inside <Elements>) ───────────────────────────────────

interface PaymentFormProps {
  amountUSD:       number;
  pointsToGrant:   number;
  paymentIntentId: string;
  onSuccess:       (pointsGranted: number, amountUSD: number) => void;
  onCancel:        () => void;
}

function PaymentForm({
  amountUSD,
  pointsToGrant,
  paymentIntentId,
  onSuccess,
  onCancel,
}: PaymentFormProps) {
  const stripe   = useStripe();
  const elements = useElements();

  const [paying,    setPaying]    = useState(false);
  const [error,     setError]     = useState('');
  const [elemReady, setElemReady] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!stripe || !elements) return;
    setError('');
    setPaying(true);

    try {
      // 1. Confirm payment through Stripe Elements
      const { error: stripeErr } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required', // stay on-page for card payments
      });

      if (stripeErr) {
        setError(stripeErr.message ?? 'Payment failed. Please try again.');
        setPaying(false);
        return;
      }

      // 2. Verify and grant points
      const res = await authFetch('/api/stripe/verify', {
        method: 'POST',
        body:   JSON.stringify({ paymentIntentId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Verification failed. Contact support.');
        setPaying(false);
        return;
      }

      // 3. Update Zustand store with fresh user (includes new balance)
      if (data.user) {
        useStore.getState().setUser(data.user);
      }

      onSuccess(data.pointsGranted, data.amountUSD);
    } catch (err) {
      setError('An unexpected error occurred. Please contact support.');
      console.error('[DEPOSIT] Payment error:', err);
      setPaying(false);
    }
  }, [stripe, elements, paymentIntentId, onSuccess]);

  return (
    <div className="space-y-6">
      {/* Receipt summary */}
      <div className="bg-[#0A0A0A] border border-[var(--border-dark)] p-5">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[8px] font-mono uppercase tracking-[0.15em] text-[var(--text-muted)] font-bold">DEBIT PRINCIPAL</span>
          <strong className="text-lg font-bold font-mono text-white">${amountUSD.toLocaleString()}</strong>
        </div>
        <div className="flex justify-between items-center mb-4">
          <span className="text-[8px] font-mono uppercase tracking-[0.1em] text-[var(--text-muted)] font-bold">INDEX RATIO</span>
          <span className="text-[9px] font-mono text-[var(--text-muted)] font-bold">1.00 USD = 100.00 PTS</span>
        </div>
        <div className="pt-4 border-t border-dashed border-[var(--border-dark)] flex justify-between items-center">
          <span className="text-[9px] font-bold font-mono uppercase tracking-[0.15em] text-[var(--rolex-gold)]">YIELD RESULT</span>
          <strong className="text-xl font-bold font-mono text-[var(--rolex-gold)]">{pointsToGrant.toLocaleString()} PTS</strong>
        </div>
      </div>

      {/* Stripe Payment Element */}
      <div className={`transition-opacity duration-300 ${elemReady ? 'opacity-100' : 'opacity-0'}`}>
        <label className="block text-[8px] font-mono uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3 font-bold">
          SECURE PAYMENT DETAILS
        </label>
        <div className="p-4 border border-[var(--border-dark)] bg-[#0a0a0a]">
          <PaymentElement
            onReady={() => setElemReady(true)}
            options={{
              layout: 'tabs',
              fields: { billingDetails: { name: 'auto' } },
            }}
          />
        </div>
      </div>

      {!elemReady && (
        <div className="py-8 text-center text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] animate-pulse">
          Loading secure payment module...
        </div>
      )}

      {error && (
        <div className="p-4 border border-red-500/30 bg-red-500/10 text-[10px] font-mono uppercase tracking-widest text-red-400">
          [ ERROR ] {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={paying}
          className="flex-1 py-4 border border-[var(--border-dark)] text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] hover:border-white/20 transition-colors disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={paying || !stripe || !elements || !elemReady}
          className="flex-[2] py-4 bg-[var(--rolex-gold)] text-black font-bold text-[11px] font-mono tracking-widest uppercase hover:bg-[var(--rolex-gold)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {paying
            ? '[ AUTHORISING ]'
            : `[ PAY $${amountUSD.toLocaleString()} USD ]`}
        </button>
      </div>

      {/* Trust badges */}
      <div className="flex items-center justify-center gap-6 pt-2">
        <span className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)]">🔒 256-BIT SSL</span>
        <span className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Powered by Stripe</span>
        <span className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)]">PCI DSS Compliant</span>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type Stage = 'select' | 'payment' | 'success';

export default function DepositPage() {
  const router = useRouter();
  const user   = useStore(s => s.user);

  const [amount,          setAmount]          = useState<number>(100);
  const [stage,           setStage]           = useState<Stage>('select');
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');
  const [clientSecret,    setClientSecret]    = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [pointsToGrant,   setPointsToGrant]   = useState(0);
  const [successPoints,   setSuccessPoints]   = useState(0);
  const [successAmount,   setSuccessAmount]   = useState(0);

  useEffect(() => {
    if (user === null) { router.push('/'); }
  }, [user, router]);

  // ── Create PaymentIntent ────────────────────────────────────────────────────
  const handleProceed = async () => {
    if (amount < MIN_USD) {
      setError(`Minimum deposit is $${MIN_USD}.`);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res  = await authFetch('/api/stripe/payment-intent', {
        method: 'POST',
        body:   JSON.stringify({ amountUSD: amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to initialise payment.');

      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
      setPointsToGrant(data.pointsToGrant);
      setStage('payment');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not initialise payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = (pts: number, usd: number) => {
    setSuccessPoints(pts);
    setSuccessAmount(usd);
    setStage('success');
  };

  // ── Stripe Elements options ─────────────────────────────────────────────────
  const elementsOptions: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme:     'night',
      variables: {
        colorPrimary:        '#a37e2c',
        colorBackground:     '#0a0a0a',
        colorText:           '#e0e0e0',
        colorDanger:         '#ef4444',
        fontFamily:          "'Courier New', Courier, monospace",
        borderRadius:        '0px',
        colorTextPlaceholder: '#555555',
      },
      rules: {
        '.Input': {
          border:          '1px solid #1a1a1a',
          backgroundColor: '#050505',
          color:           '#e0e0e0',
          padding:         '12px 14px',
        },
        '.Input:focus': {
          border:    '1px solid #a37e2c',
          boxShadow: 'none',
          outline:   'none',
        },
        '.Label': {
          color:         '#555',
          fontSize:      '9px',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          fontWeight:    '700',
        },
        '.Tab': {
          border:          '1px solid #1a1a1a',
          backgroundColor: '#0a0a0a',
          color:           '#555',
        },
        '.Tab--selected': {
          border:          '1px solid #a37e2c',
          backgroundColor: '#0a0a0a',
          color:           '#a37e2c',
          boxShadow:       'none',
        },
      },
    },
  };

  // ─── Success screen ─────────────────────────────────────────────────────────
  if (stage === 'success') {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-white font-sans pt-24 pb-24 flex items-center justify-center">
        <div className="max-w-lg w-full mx-auto px-4 text-center">
          <div className="w-16 h-16 border border-[var(--rolex-gold)] flex items-center justify-center mx-auto mb-6">
            <span className="text-[var(--rolex-gold)] text-2xl">✓</span>
          </div>
          <p className="text-[9px] font-mono tracking-[0.25em] text-[var(--rolex-gold)] mb-3 uppercase">ACQUISITION COMPLETE</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tighter text-white mb-4 uppercase">
            ${successAmount.toFixed(2)} Deposited
          </h1>
          <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--text-secondary)] mb-10">
            {successPoints.toLocaleString()} PTS credited to your protocol account
          </p>
          <div className="bg-[#050505] border border-[var(--border-dark)] p-6 mb-8 text-left">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Amount Paid</span>
              <span className="font-mono text-sm text-white">${successAmount.toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Points Credited</span>
              <span className="font-mono text-sm text-[var(--rolex-gold)]">{successPoints.toLocaleString()} PTS</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)]">New Balance</span>
              <span className="font-mono text-sm text-white">{user?.points?.toLocaleString()} PTS</span>
            </div>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-4 bg-[var(--rolex-gold)] text-black font-bold text-[11px] font-mono tracking-widest uppercase hover:bg-[var(--rolex-gold)]/90 transition-colors"
          >
            [ ENTER VAULT ]
          </button>
        </div>
      </div>
    );
  }

  // ─── Main page ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-white font-sans pt-24 pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-8">

        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-[9px] font-mono tracking-[0.25em] text-[var(--rolex-gold)] mb-3 uppercase flex justify-center items-center gap-2 font-bold">
            <span className="w-1.5 h-1.5 bg-[var(--rolex-gold)] rounded-full animate-pulse" />
            TREASURY DEPOSIT
          </p>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tighter text-white mb-4 uppercase leading-none">
            Fund Your Account
          </h1>
          <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--text-secondary)] leading-relaxed max-w-sm mx-auto font-semibold">
            Deposit USD via Stripe. Funds are converted to protocol points at $1 = 100 PTS.
          </p>
        </div>

        <div className="bg-[#050505] border border-[var(--border-dark)] p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-[var(--rolex-gold)] opacity-50" />

          {stage === 'select' && (
            <>
              {/* Amount selection */}
              <div className="mb-8">
                <label className="block text-[8px] font-mono uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3 font-bold">
                  ALLOCATION BRACKET
                </label>
                <div className="grid grid-cols-4 gap-2 mb-6">
                  {AMOUNTS.map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAmount(val)}
                      className={`py-2.5 text-[10px] font-mono font-bold tracking-widest uppercase border transition-all ${
                        amount === val
                          ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                          : 'bg-[#0A0A0A] text-[var(--text-muted)] border-[var(--border-dark)] hover:bg-white/5'
                      }`}
                    >
                      ${val}
                    </button>
                  ))}
                </div>

                <label className="block text-[8px] font-mono uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3 font-bold">
                  CUSTOM ALLOCATION
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--rolex-gold)] font-mono font-bold text-xl">$</span>
                  <input
                    type="number"
                    min={MIN_USD}
                    max={MAX_USD}
                    step="1"
                    className="w-full bg-[#0A0A0A] border border-[var(--border-dark)] p-4 pl-10 text-2xl font-mono font-bold text-[var(--rolex-gold)] focus:outline-none focus:border-[var(--rolex-gold)] transition-colors"
                    value={amount}
                    onChange={e => {
                      const v = parseInt(e.target.value);
                      if (isNaN(v) || v < 0) { setAmount(0); return; }
                      setAmount(Math.min(v, MAX_USD));
                    }}
                    onBlur={() => { if (amount < MIN_USD) setAmount(MIN_USD); }}
                  />
                </div>
              </div>

              {/* Receipt breakdown */}
              <div className="bg-[#0A0A0A] border border-[var(--border-dark)] p-6 mb-8">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[8px] font-mono uppercase tracking-[0.1em] text-[var(--text-secondary)] font-bold">DEBIT PRINCIPAL</span>
                  <strong className="text-lg font-bold font-mono text-white tracking-tighter">${amount.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between items-center mb-5">
                  <span className="text-[8px] font-mono uppercase tracking-[0.1em] text-[var(--text-muted)] font-bold">INDEX RATIO</span>
                  <span className="text-[9px] font-mono text-[var(--text-muted)] font-bold">1.00 USD = 100.00 PTS</span>
                </div>
                <div className="pt-5 border-t border-dashed border-[var(--border-dark)] flex justify-between items-center">
                  <span className="text-[9px] font-bold font-mono uppercase tracking-[0.15em] text-[var(--rolex-gold)]">YIELD RESULT</span>
                  <strong className="text-xl font-bold font-mono text-[var(--rolex-gold)] tracking-tighter">{(amount * 100).toLocaleString()} PTS</strong>
                </div>
              </div>

              {/* Security badge */}
              <div className="bg-[#0A0A0A]/50 border border-[var(--border-dark)] p-4 mb-10 flex items-start gap-4">
                <span className="text-[9px] font-mono font-bold text-[var(--rolex-gold)] whitespace-nowrap">[ STRIPE_SECURE ]</span>
                <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest leading-relaxed">
                  Payments are processed by Stripe with 256-bit SSL encryption. Tokenly never stores your card details.
                </span>
              </div>

              {error && (
                <div className="mb-6 p-4 border border-red-500/30 bg-red-500/10 text-[10px] font-mono uppercase tracking-widest text-red-400">
                  [ ERROR ] {error}
                </div>
              )}

              <button
                onClick={handleProceed}
                disabled={loading || amount < MIN_USD}
                className="w-full py-5 bg-[var(--rolex-gold)] text-black font-bold text-[11px] font-mono tracking-widest uppercase hover:bg-[var(--rolex-gold)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? '[ INITIALISING PAYMENT ]'
                  : `[ PROCEED TO SECURE PAYMENT — $${amount.toLocaleString()} ]`}
              </button>

              {user && (
                <div className="text-center mt-8 text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
                  CURRENT BALANCE:{' '}
                  <strong className="text-[var(--rolex-gold)] font-bold">{user.points?.toLocaleString()} PTS</strong>
                </div>
              )}
            </>
          )}

          {/* ── Payment stage: Stripe Elements ─────────────────────────────── */}
          {stage === 'payment' && clientSecret && (
            <Elements stripe={stripePromise} options={elementsOptions}>
              <PaymentForm
                amountUSD={amount}
                pointsToGrant={pointsToGrant}
                paymentIntentId={paymentIntentId}
                onSuccess={handleSuccess}
                onCancel={() => {
                  setStage('select');
                  setClientSecret('');
                  setError('');
                }}
              />
            </Elements>
          )}

        </div>
      </div>
    </div>
  );
}
