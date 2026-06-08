import type { CSSProperties, HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'gold' | 'success' | 'danger';
};

const toneStyle: Record<NonNullable<BadgeProps['tone']>, CSSProperties> = {
  neutral: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' },
  gold: { background: 'rgba(163,126,44,0.10)', border: '1px solid rgba(163,126,44,0.30)', color: 'var(--rolex-gold)' },
  success: { background: 'var(--success-bg)', border: '1px solid rgba(0,168,107,0.35)', color: 'var(--success)' },
  danger: { background: 'var(--danger-bg)', border: '1px solid rgba(207,79,79,0.35)', color: 'var(--danger)' },
};

export function Badge({ tone = 'neutral', className, style, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={cn('status-badge', className)}
      style={{ padding: '6px 10px', borderRadius: '10px', fontWeight: 800, fontSize: '0.7rem', ...toneStyle[tone], ...(style || {}) }}
    />
  );
}

