import crypto from 'crypto';

/**
 * Input sanitization & validation utilities
 * Prevents XSS, SQL injection, and other injection attacks
 */

/**
 * Sanitize text input by stripping HTML tags and dangerous characters
 * Used for review text, user names, chat messages, etc.
 */
export function sanitizeText(input: string, maxLength: number = 2000): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove script-like patterns
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    // Remove null bytes
    .replace(/\0/g, '')
    // Trim and limit length
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitize a user name — more restrictive, alphanumeric + basic punctuation only
 */
export function sanitizeName(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\s\-.']/g, '')
    .trim()
    .slice(0, 100);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const cleaned = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) && cleaned.length <= 254;
}

/**
 * Validate a numeric value is within range
 */
export function validateNumber(value: unknown, min: number, max: number): number | null {
  const num = Number(value);
  if (isNaN(num) || num < min || num > max) return null;
  return num;
}

/**
 * Escape special characters for safe display (not needed with React, but useful for server-side rendering)
 */
export function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return str.replace(/[&<>"']/g, c => map[c] || c);
}

/**
 * Generate a high-entropy 64-character hex key for encryption/auth
 */
export function generateKey(): string {
  try {
    return crypto.randomBytes(32).toString('hex');
  } catch {
    // Fallback for non-node environments if used in client (though usually server-only)
    return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
}

/**
 * Global rate-limiting threshold check
 * Returns true if request should be allowed
 */
export function isRateLimited(currentCount: number, limit: number): boolean {
  return currentCount > limit;
}
