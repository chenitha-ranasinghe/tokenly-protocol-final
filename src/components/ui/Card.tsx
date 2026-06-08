import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: 'glass' | 'plain';
};

export function Card({ variant = 'glass', className, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={cn(variant === 'glass' ? 'glass-card' : '', className)}
    />
  );
}

