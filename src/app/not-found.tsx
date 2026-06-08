'use client';
import { motion } from 'framer-motion';

export default function NotFound() {
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
    }}>
      <motion.div
        initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        style={{ textAlign: 'center', maxWidth: 500 }}
      >
        <div style={{
          fontSize: '6rem',
          fontWeight: 500,
          fontFamily: 'var(--font-mono)',
          color: 'var(--rolex-gold)',
          lineHeight: 1,
          marginBottom: 24,
        }}>
          404
        </div>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: 60 }}
          transition={{ delay: 0.4, duration: 1 }}
          style={{ height: 1, background: 'var(--rolex-gold)', margin: '0 auto 24px' }}
        />
        <h1 style={{
          fontSize: '1.4rem',
          fontWeight: 500,
          letterSpacing: '0.15em',
          color: 'var(--text-primary)',
          textTransform: 'uppercase',
          marginBottom: 16,
        }}>
          Node Not Found
        </h1>
        <p style={{
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          lineHeight: 1.8,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 40,
        }}>
          The requested protocol endpoint does not exist or has been decommissioned from the network.
        </p>
        <a
          href="/dashboard"
          style={{
            display: 'inline-block',
            padding: '16px 32px',
            background: 'var(--rolex-gold)',
            color: '#000',
            fontSize: '0.8rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            textDecoration: 'none',
            transition: 'filter 0.2s',
          }}
        >
          Return to Terminal
        </a>
      </motion.div>
    </div>
  );
}
