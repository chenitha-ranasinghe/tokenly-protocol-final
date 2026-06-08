# Tokenly Protocol — Security Notes v5.0

## Environment Variables
| Variable | Required | Notes |
|---|---|---|
| `ENCRYPTION_KEY` | **YES** | 64-hex-char AES-256 key. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DATABASE_URL` | Prod only | Postgres connection string. Omit for local SQLite. |
| `NEXT_PUBLIC_PRIVY_APP_ID` | YES | Privy project ID for Web3 auth. |
| `ANTHROPIC_API_KEY` | YES | Powers AI advisor, compliance engine, price prediction. |
| `ENABLE_DEV_BYPASS` | Dev only | Set `true` only in local dev. **Never in production.** |

## Security Architecture
- **Encryption**: Wallet private keys are AES-256-CBC encrypted at rest. The key is required at startup — the app fails hard if missing.
- **Auth**: httpOnly session cookies only. No localStorage for auth tokens.
- **Admin**: Requires BOTH `is_admin=1` DB flag AND known admin email — defense in depth.
- **GDPR**: Leaderboard never exposes email addresses. Search is by display name only.
- **CSP**: Content-Security-Policy headers set on every response via middleware.
- **Audit**: All admin actions, trades, and security events are logged in `audit_log` with integrity hashes.
- **Rate limiting**: Auth, reviews, AI chat, and trade routes all rate-limited per IP or user.
- **Wash trading**: Min 10-minute interval per user per asset, 15% price deviation cap, 20 trades/hour max.

## Reporting Vulnerabilities
Contact: security@tokenly.io
