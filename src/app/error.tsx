'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      position: 'relative',
      zIndex: 10,
      background: 'var(--bg-primary)',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        style={{ textAlign: 'center', maxWidth: 500 }}
      >
        <div style={{
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          color: 'var(--danger)',
          marginBottom: 20,
          fontWeight: 700,
        }}>
          [ SYSTEM ANOMALY DETECTED ]
        </div>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
          marginBottom: 16,
        }}>
          Protocol Interruption
        </h1>
        <p style={{
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          lineHeight: 1.8,
          marginBottom: 12,
        }}>
          An unexpected error occurred in the protocol execution layer.
        </p>
        {error.digest && (
          <p style={{
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            marginBottom: 32,
          }}>
            Error Digest: {error.digest}
          </p>
        )}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              padding: '16px 32px',
              background: 'var(--rolex-gold)',
              color: '#000',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              cursor: 'pointer',
            }}
          >
            Retry Protocol
          </button>
          <Link
            href="/"
            style={{
              padding: '16px 32px',
              background: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            Return Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
