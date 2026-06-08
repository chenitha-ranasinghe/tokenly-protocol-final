# Tokenly Protocol v5.0
**The Global Liquidity Layer for Physical Assets**

Authentication · Liquidity · Fair Pricing — In that order. Always.

---

## Quick Start

### 1. Generate required secrets
```bash
# Generate ENCRYPTION_KEY (required before first run)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Configure environment
```bash
cp .env.example .env.local
# Fill in: ENCRYPTION_KEY, NEXT_PUBLIC_PRIVY_APP_ID, ANTHROPIC_API_KEY
```

### 3. Install and run
```bash
npm install
npm run dev
```

---

## Architecture

### Core Modules
| Module | Purpose |
|---|---|
| `lib/wisdom-engine.ts` | Weighted price signal: 60% internal trades + 25% external ref + 10% staked reviews + 5% recency |
| `lib/rrs.ts` | Reviewer Reputation Score: Accuracy(45%) + Volume(25%) + Consistency(20%) + Longevity(10%) |
| `lib/wash-trading.ts` | Wash trading prevention: 10min cooldown, 15% price cap, 20 trades/hr limit |
| `lib/audit.ts` | Immutable audit log with SHA-256 integrity hashes — required for MAS compliance |
| `lib/can.ts` | CAN Authenticator Network: Tiered bond system (500/2000/5000 TLY) |
| `lib/env.ts` | Startup env validation — throws hard if ENCRYPTION_KEY missing |

### API Endpoints
| Route | Auth | Description |
|---|---|---|
| `POST /api/auth` | Public | Email/password login + signup |
| `POST /api/auth/sync` | Public | Privy Web3 identity sync |
| `GET /api/leaderboard` | Required | RRS leaderboard (no emails) |
| `GET /api/wisdom?productId=` | Required | Wisdom Engine price signal |
| `POST /api/ai` | Required | Claude AI advisor |
| `POST /api/ai-predict` | Required | Claude AI price prediction |
| `POST /api/archionlabs/compliance` | Public | Real Claude-powered compliance analysis |
| `POST /api/archionlabs/simulation` | Public | Real Claude-powered crowd flow sim |
| `GET /api/ticker` | Public | Real platform stats (users, reviews, trades) |

### Security Fixes (v5.0)
- ✅ No hardcoded fallback encryption key — throws at startup if missing
- ✅ Email removed from leaderboard response (GDPR fix)
- ✅ Developer bypass route hidden in production (404)
- ✅ Admin auth: requires BOTH `is_admin=1` AND known email
- ✅ All auth via httpOnly cookies — no localStorage for tokens
- ✅ Error messages sanitized — internal errors never exposed to client
- ✅ CSP headers on every response
- ✅ God Mode admin override removed from CAN tier calculation
- ✅ ArchionLabs: real Claude AI responses, no fake sleep timers

### Fake Claims Removed (v5.0)
- ✅ Landing page ticker now shows real DB data (users, reviews, trades)
- ✅ No more "On-chain finality" / "Immutable Verification" false claims
- ✅ ArchionLabs powered by real Claude AI, not hardcoded JSON
- ✅ Protocol stats reflect real capabilities

---

## CAN Authenticator Network — Bond Tiers
| Tier | Item Value | Min Bond (TLY) | Fee Reduction |
|---|---|---|---|
| Tier 1 — Network Inspector | Under $200 | 500 TLY | 20% |
| Tier 2 — Master Authenticator | $200–$2,000 | 2,000 TLY | 50% |
| Tier 3 — Gemologist Partner | Above $2,000 | 5,000 TLY | 80% |

## RRS Scoring Formula
```
RRS = (Accuracy × 0.45) + (Volume × 0.25) + (Consistency × 0.20) + (Longevity × 0.10)
```
| Score | Tier | Fee Rate |
|---|---|---|
| 85–100 | Verified Elite | 0% |
| 70–84 | Expert | 0.5% |
| 55–69 | Trusted | 1.0% |
| 40–54 | Reviewer | 2.0% |
| 0–39 | Newcomer | 3.0% |

---

## V5.0 Changelog
- **Wisdom Engine v2.0**: Real weighted-average price model with exponential recency decay
- **Claude AI Integration**: AI advisor, price prediction, and compliance analysis all use real Claude API
- **Security hardening**: 8 critical security fixes applied
- **TypeScript cleanup**: `any` types replaced with proper interfaces throughout
- **GDPR compliance**: Email removed from all public-facing responses
- **Honest marketing**: Fake blockchain claims replaced with accurate descriptions
