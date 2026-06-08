'use client';

/**
 * /reset-password?token=xxxx — Set a new password using the emailed token.
 *
 * Reads the token from the URL search params, validates it server-side,
 * updates the password, and sets a fresh session cookie so the user is
 * signed in immediately after resetting.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

type Stage = 'form' | 'submitting' | 'success' | 'invalid';

function ResetPasswordInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get('token') ?? '';

  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [stage,     setStage]     = useState<Stage>('form');
  const [error,     setError]     = useState('');
  const [showPwd,   setShowPwd]   = useState(false);

  // Redirect immediately if no token in URL
  useEffect(() => {
    if (!token) setStage('invalid');
  }, [token]);

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = useCallback((): string => {
    if (password.length < 8)   return 'Password must be at least 8 characters.';
    if (password.length > 128) return 'Password exceeds maximum length.';
    if (password !== confirm)  return 'Passwords do not match.';
    // Entropy check: require at least one letter and one non-letter
    if (!/[a-zA-Z]/.test(password)) return 'Password must contain at least one letter.';
    if (!/[^a-zA-Z]/.test(password)) return 'Password must contain at least one number or symbol.';
    return '';
  }, [password, confirm]);

  const strengthLabel = (): { label: string; color: string } => {
    if (password.length === 0) return { label: '', color: '' };
    const score = [
      password.length >= 12,
      /[A-Z]/.test(password),
      /[0-9]/.test(password),
      /[^a-zA-Z0-9]/.test(password),
    ].filter(Boolean).length;
    if (score <= 1) return { label: 'WEAK',   color: 'text-red-400' };
    if (score === 2) return { label: 'FAIR',   color: 'text-yellow-400' };
    if (score === 3) return { label: 'STRONG', color: 'text-[var(--rolex-gold)]' };
    return               { label: 'EXCELLENT', color: 'text-green-400' };
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setError('');
    setStage('submitting');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStage('success');
        // Brief pause before redirecting (let success UI settle)
        setTimeout(() => router.push('/dashboard'), 2200);
      } else {
        setError(data.error ?? 'Reset failed. Your link may have expired.');
        setStage('form');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
      setStage('form');
    }
  };

  const strength = strengthLabel();

  // ── Invalid token state ─────────────────────────────────────────────────────
  if (stage === 'invalid') {
    return (
      <div className="text-center py-8">
        <div className="w-14 h-14 border border-red-500/50 flex items-center justify-center mx-auto mb-6">
          <span className="text-red-400 text-2xl">✕</span>
        </div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-red-400 mb-6">
          Invalid or Expired Link
        </p>
        <p className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wide leading-relaxed mb-8">
          This reset link is invalid, has already been used, or has expired.<br />
          Reset links are valid for 15 minutes.
        </p>
        <Link
          href="/forgot-password"
          className="block w-full py-4 bg-[var(--rolex-gold)] text-black font-bold text-[11px] font-mono tracking-widest uppercase hover:bg-[var(--rolex-gold)]/90 transition-colors text-center mb-3"
        >
          [ REQUEST NEW LINK ]
        </Link>
        <Link
          href="/"
          className="block text-center text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--rolex-gold)] transition-colors"
        >
          ← Return to Sign In
        </Link>
      </div>
    );
  }

  // ── Success state ───────────────────────────────────────────────────────────
  if (stage === 'success') {
    return (
      <div className="text-center py-8">
        <div className="w-14 h-14 border border-[var(--rolex-gold)] flex items-center justify-center mx-auto mb-6">
          <span className="text-[var(--rolex-gold)] text-2xl">✓</span>
        </div>
        <p className="text-[9px] font-mono tracking-[0.25em] text-[var(--rolex-gold)] mb-3 uppercase">
          PASSWORD UPDATED
        </p>
        <h2 className="text-2xl font-bold tracking-tighter text-white mb-4 uppercase">
          Security Restored
        </h2>
        <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest leading-relaxed mb-6">
          Your password has been updated. You are now signed in.<br />
          Redirecting to your dashboard...
        </p>
        <div className="flex justify-center">
          <span className="inline-block w-40 h-[2px] bg-[var(--rolex-gold)] animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Form state ──────────────────────────────────────────────────────────────
  return (
    <>
      {/* New Password */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <label className="text-[8px] font-mono uppercase tracking-[0.15em] text-[var(--text-muted)] font-bold">
            NEW PASSWORD
          </label>
          {strength.label && (
            <span className={`text-[8px] font-mono uppercase tracking-widest font-bold ${strength.color}`}>
              {strength.label}
            </span>
          )}
        </div>
        <div className="relative">
          <input
            type={showPwd ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Minimum 8 characters"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            className="w-full bg-[#0A0A0A] border border-[var(--border-dark)] p-4 pr-16 font-mono text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--rolex-gold)] transition-colors"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPwd(v => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--rolex-gold)] transition-colors"
          >
            {showPwd ? 'HIDE' : 'SHOW'}
          </button>
        </div>
      </div>

      {/* Confirm Password */}
      <div className="mb-6">
        <label className="block text-[8px] font-mono uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3 font-bold">
          CONFIRM PASSWORD
        </label>
        <input
          type={showPwd ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Repeat new password"
          value={confirm}
          onChange={e => { setConfirm(e.target.value); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter' && stage === 'form') handleSubmit(); }}
          className={`w-full bg-[#0A0A0A] border p-4 font-mono text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--rolex-gold)] transition-colors ${
            confirm.length > 0 && confirm !== password
              ? 'border-red-500/50'
              : 'border-[var(--border-dark)]'
          }`}
        />
        {confirm.length > 0 && confirm !== password && (
          <p className="mt-1 text-[8px] font-mono uppercase tracking-widest text-red-400">
            Passwords do not match
          </p>
        )}
      </div>

      {/* Requirements */}
      <div className="bg-[#0A0A0A] border border-[var(--border-dark)] p-4 mb-6">
        <p className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-2">REQUIREMENTS</p>
        {[
          { check: password.length >= 8,           text: '8 or more characters' },
          { check: /[a-zA-Z]/.test(password),      text: 'At least one letter' },
          { check: /[^a-zA-Z]/.test(password),     text: 'At least one number or symbol' },
          { check: password === confirm && password.length > 0, text: 'Passwords match' },
        ].map(({ check, text }) => (
          <div key={text} className="flex items-center gap-2 mb-1">
            <span className={`text-[8px] ${check ? 'text-[var(--rolex-gold)]' : 'text-[#333]'}`}>
              {check ? '✓' : '○'}
            </span>
            <span className={`text-[8px] font-mono uppercase tracking-wide ${check ? 'text-[var(--text-secondary)]' : 'text-[#444]'}`}>
              {text}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-6 p-3 border border-red-500/30 bg-red-500/10 text-[10px] font-mono uppercase tracking-widest text-red-400">
          [ ERROR ] {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={stage === 'submitting' || password.length < 8 || password !== confirm}
        className="w-full py-4 bg-[var(--rolex-gold)] text-black font-bold text-[11px] font-mono tracking-widest uppercase hover:bg-[var(--rolex-gold)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
      >
        {stage === 'submitting' ? '[ UPDATING CREDENTIALS ]' : '[ SET NEW PASSWORD ]'}
      </button>

      <Link
        href="/forgot-password"
        className="block text-center text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--rolex-gold)] transition-colors"
      >
        ← Request a New Link
      </Link>
    </>
  );
}

// ── Page wrapper with Suspense (required for useSearchParams) ─────────────────

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-white font-sans pt-24 pb-24">
      <div className="max-w-md mx-auto px-4 sm:px-8">

        <div className="text-center mb-10">
          <p className="text-[9px] font-mono tracking-[0.25em] text-[var(--rolex-gold)] mb-3 uppercase font-bold">
            TOKENLY PROTOCOL
          </p>
          <h1 className="text-3xl font-bold tracking-tighter text-white mb-4 uppercase leading-none">
            Set New Password
          </h1>
          <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--text-secondary)] leading-relaxed font-semibold">
            Choose a strong password for your protocol account.
          </p>
        </div>

        <div className="bg-[#050505] border border-[var(--border-dark)] p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-[var(--rolex-gold)] opacity-50" />
          <Suspense fallback={
            <div className="py-12 text-center text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] animate-pulse">
              Loading reset module...
            </div>
          }>
            <ResetPasswordInner />
          </Suspense>
        </div>

      </div>
    </div>
  );
}
