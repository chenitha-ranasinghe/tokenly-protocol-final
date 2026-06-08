/**
 * Environment Variable Validation — Tokenly Protocol v5.0
 * Throws at startup if any critical env var is missing. No silent fallbacks ever.
 */
function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val || val.trim() === '') {
    throw new Error(
      `[STARTUP FATAL] Missing required environment variable: ${name}\n` +
      `  Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"\n` +
      `  Set ${name}=<value> in .env.local or deployment secrets.\n` +
      `  NEVER use a hardcoded fallback — it compromises every user private key.`
    );
  }
  return val;
}

/** AES-256 key for encrypting wallet private keys (must be 64 hex chars / 32 bytes). */
export function getEncryptionKey(): Buffer {
  const hex = requireEnv('ENCRYPTION_KEY');
  if (hex.length !== 64) {
    throw new Error(
      `[STARTUP FATAL] ENCRYPTION_KEY must be exactly 64 hex chars (32 bytes). ` +
      `Got ${hex.length}. Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }
  return Buffer.from(hex, 'hex');
}

export function validateEnv(): void { getEncryptionKey(); }
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const DEV_BYPASS_ENABLED = !IS_PRODUCTION && process.env.ENABLE_DEV_BYPASS === 'true';
