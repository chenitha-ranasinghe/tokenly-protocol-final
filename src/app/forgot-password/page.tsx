'use client';

/**
 * /forgot-password — Request a password reset email.
 *
 * Deliberately vague response so attackers cannot enumerate registered emails.
 * Always shows the same success message regardless of whether the email exists.
 */

import { useState } from 'react';
import Link from 'next/link';

type Stage = 'form' | 'sent';

export default function ForgotPasswordPage() {
  const [email,      setEmail]      = useState('');
  const [stage,      setStage]      = useState<Stage>('form');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const handleSubmit = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean.includes('@') || !clean.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: clean }),
      });

      // Always show success regardless of server response (anti-enumeration)
      if (res.ok || res.status === 429) {
        setStage('sent');
      } else {
        setError('An error occurred. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-white font-sans pt-24 pb-24">
      <div className="max-w-md mx-auto px-4 sm:px-8">

        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-[9px] font-mono tracking-[0.25em] text-[var(--rolex-gold)] mb-3 uppercase font-bold">
            TOKENLY PROTOCOL
          </p>
          <h1 className="text-3xl font-bold tracking-tighter text-white mb-4 uppercase leading-none">
            {stage === 'form' ? 'Reset Password' : 'Check Your Email'}
          </h1>
          <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--text-secondary)] leading-relaxed font-semibold">
            {stage === 'form'
              ? 'Enter your account email to receive a reset link.'
              : 'A reset link has been dispatched if that address is registered.'}
          </p>
        </div>

        <div className="bg-[#050505] border border-[var(--border-dark)] p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-[var(--rolex-gold)] opacity-50" />

          {stage === 'form' ? (
            <>
              {/* Email field */}
              <div className="mb-6">
                <label className="block text-[8px] font-mono uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3 font-bold">
                  REGISTERED EMAIL
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="vault@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter' && !submitting) handleSubmit(); }}
                  className="w-full bg-[#0A0A0A] border border-[var(--border-dark)] p-4 font-mono text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--rolex-gold)] transition-colors"
                />
              </div>

              {error && (
                <div className="mb-6 p-3 border border-red-500/30 bg-red-500/10 text-[10px] font-mono uppercase tracking-widest text-red-400">
                  [ ERROR ] {error}
                </div>
              )}

              {/* Notice */}
              <div className="bg-[#0A0A0A]/50 border border-[var(--border-dark)] p-4 mb-6 flex items-start gap-3">
                <span className="text-[9px] font-mono font-bold text-[var(--rolex-gold)] whitespace-nowrap mt-0.5">[ SECURITY ]</span>
                <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest leading-relaxed">
                  Reset links expire after 15 minutes and are single-use only.
                </span>
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || email.length < 3}
                className="w-full py-4 bg-[var(--rolex-gold)] text-black font-bold text-[11px] font-mono tracking-widest uppercase hover:bg-[var(--rolex-gold)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                {submitting ? '[ TRANSMITTING ]' : '[ SEND RESET LINK ]'}
              </button>

              <Link
                href="/"
                className="block text-center text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--rolex-gold)] transition-colors"
              >
                ← Return to Sign In
              </Link>
            </>
          ) : (
            <>
              {/* Success state */}
              <div className="text-center py-6">
                <div className="w-14 h-14 border border-[var(--rolex-gold)] flex items-center justify-center mx-auto mb-6">
                  <span className="text-[var(--rolex-gold)] text-2xl">✉</span>
                </div>

                <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest leading-relaxed mb-8">
                  If <strong className="text-white">{email}</strong> is registered,<br />
                  a reset link has been sent. Check your inbox and spam folder.
                </p>

                <div className="bg-[#0A0A0A] border border-[var(--border-dark)] p-4 mb-8 text-left">
                  <p className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-2">NEXT STEPS</p>
                  <ul className="space-y-2">
                    {[
                      'Open the reset email from Tokenly Protocol',
                      'Click the password reset button',
                      'Choose a strong new password',
                      'You will be signed in automatically',
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-3 text-[9px] font-mono text-[var(--text-secondary)] uppercase tracking-wide">
                        <span className="text-[var(--rolex-gold)] font-bold shrink-0">{String(i + 1).padStart(2, '0')}.</span>
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => { setStage('form'); setEmail(''); }}
                  className="w-full mb-3 py-3 border border-[var(--border-dark)] text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] hover:border-white/20 transition-colors"
                >
                  Try a Different Email
                </button>

                <Link
                  href="/"
                  className="block text-center text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--rolex-gold)] transition-colors"
                >
                  ← Return to Sign In
                </Link>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
