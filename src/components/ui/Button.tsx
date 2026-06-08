'use client';

import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const variantClass: Record<Variant, string> = {
  primary: 'btn btn-primary',
  outline: 'btn btn-outline',
  ghost: 'btn',
  danger: 'btn',
};

const sizeClass: Record<Size, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

export function Button({ variant = 'primary', size = 'md', className, style, ...props }: ButtonProps) {
  const dangerStyle = variant === 'danger'
    ? {
        background: 'transparent',
        border: '1px solid var(--danger)',
        color: 'var(--danger)',
        ...(style || {}),
      }
    : style;

  return (
    <button
      {...props}
      className={cn(variantClass[variant], sizeClass[size], className)}
      style={dangerStyle}
    />
  );
}

