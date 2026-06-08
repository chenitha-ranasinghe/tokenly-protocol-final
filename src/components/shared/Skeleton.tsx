'use client';
import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
}

export function Skeleton({ className = '', width, height, borderRadius = '2px' }: SkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      className={`skeleton ${className}`}
      style={{
        width: width || '100%',
        height: height || '20px',
        borderRadius,
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="glass-card p-6 flex flex-col gap-4">
      <Skeleton height="24px" width="60%" />
      <Skeleton height="14px" width="40%" />
      <div className="flex-grow" />
      <Skeleton height="40px" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full space-y-4">
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height="12px" width={`${100 / cols}%`} />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-[var(--border-dark)] pb-4">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} height="16px" width={`${100 / cols}%`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
