# Tokenly — Ultimate Production Platform

> The Global Liquidity Layer for Physical Assets
> Proof of Honest Experience · Fungible Asset Vaults · Decentralized Trust Protocol

---

## Quick Start (5 minutes)

```bash
npm install
cp .env.example .env.local
# Fill in .env.local (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

```bash
# Required — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=<64 hex chars>

# Privy auth — free at privy.io
NEXT_PUBLIC_PRIVY_APP_ID=<from privy.io>

# Groq AI — FREE, no credit card — console.groq.com
GROQ_API_KEY=<from console.groq.com>
```

---

## AI Stack — 100% Free via Groq (14,400 req/day)

| Route | Model | Purpose |
|---|---|---|
| `POST /api/ai-vision` | Llama 3.2 Vision | Physical asset authentication |
| `POST /api/ai-predict` | Llama 3.3 70B | 30/60/90-day price forecast |
| `POST /api/ai` | Llama 3.1 8B Instant | Platform AI assistant |
| `POST /api/ai/portfolio-risk` | Llama 3.3 70B | Portfolio risk analysis |
| `GET /api/wisdom/report` | Llama 3.3 70B | Weekly market intelligence |
| `POST /api/archionlabs/compliance` | Llama 3.3 70B | BIM compliance scanning |
| `POST /api/archionlabs/simulation` | Llama 3.3 70B | Structural simulation |
| `GET /api/archionlabs/viewer` | Llama 3.1 8B | WebXR session metadata |
| `GET /api/ai-traders` | Llama 3.3 70B | AI market commentary |

**Upgrade path:** change `GROQ_BASE` + model names in `lib/groq.ts` to use Claude when ready.

---

## Feature Set

### Core Platform
- **Fungible Vault Tokens** — tokenize authenticated physical assets into tradeable shares
- **CAN Authentication** — bonded human authenticators with tiered verification
- **Wisdom Engine** — real price discovery: 60% trades + 25% external + 10% reviews + 5% recency
- **Review Staking** — opt-in power-user trust layer with RRS scoring
- **Wash Trading Detection** — wallet clustering, volume spike alerts, price movement caps

### New Features (v6)
- **Price Alerts** — set target price + direction; fires real notification on every trade execution
- **Authenticity Certificates** — print-to-PDF HTML certificate for vault token holders
- **Portfolio Risk Analyzer** — AI-powered concentration, liquidity, diversification scoring
- **Global Smart Search** — relevance-ranked search in Navbar, 300ms debounce
- **Weekly Market Report** — 7-day trade aggregation + Groq analysis, 1hr cache
- **Live Trade Feed** — anonymized real-time market activity, 30s auto-refresh

### Pages
| Route | Description |
|---|---|
| `/` | Landing page with live trade feed |
| `/dashboard` | User command centre |
| `/vault` | Product marketplace |
| `/vault/[id]` | Asset detail: trade, alert, certificate, orderbook |
| `/can` | CAN authenticator network |
| `/portfolio` | Holdings, P&L, risk analysis |
| `/market` | Weekly market intelligence report |
| `/archionlabs` | Building compliance + simulation suite |
| `/leaderboard` | RRS rankings |
| `/analytics` | A/B experiment analytics |

---

## Architecture

```
app/api/              — 30+ typed API routes, zero any types
components/
  features/           — PriceAlerts, PortfolioRisk, MarketFeed, GlobalSearch
  vault/              — AlertModal, OrderBook, WisdomPriceCard
  dashboard/          — DashboardStats, PortfolioTable
  can/                — CANTierCard
  archionlabs/        — CompliancePanel, SimulationPanel, ViewerPanel
lib/
  groq.ts             — Groq AI client (swap to Claude when ready)
  wisdom-engine.ts    — Real Wisdom Engine with exponential decay
  store.ts            — Zustand auth (httpOnly cookies, no localStorage)
  env.ts              — Startup validation, throws on missing keys
  db-types.ts         — Typed DB interfaces
  session.ts          — authenticateRequest() + isAdmin() dual-check
  audit.ts            — Immutable audit trail
```

---

## Security

| Layer | Status |
|---|---|
| Encryption key | Throws at startup if missing — no fallback |
| Session auth | httpOnly cookies only — no localStorage |
| Admin access | Dual check: email + `is_admin=1` |
| Error handling | Generic client messages, internals logged server-side |
| Leaderboard | Email excluded (GDPR) |
| GDPR | Right to erasure + data portability |
| Security headers | HSTS, CSP (api.groq.com), X-Frame-Options, Referrer-Policy |
| TypeScript | Zero `any` types across entire project |
| New routes | `/api/alerts`, `/api/feed`, `/api/search`, `/api/wisdom`, `/api/certificate` all auth-gated |

---

## Version History

| Version | Changes |
|---|---|
| **v7 (current)** | Zero `any` types (was 50). Auth on all new routes. Certificate fake text fixed. Alerts validation + rate limiting. `vault/[id]` extracted AlertModal + OrderBook components (527→391 lines). `market/page.tsx` authFetch + MarketReport interface. |
| v6 | 6 new features: Price Alerts, Authenticity Certificates, Portfolio Risk AI, Smart Search, Market Intelligence, Live Trade Feed |
| v5.3 | Build crash fixed, PortfolioTable real data, CSP corrected, last any types eliminated |
| v5.2 | Groq/Llama AI (free), setAuth crash fixed, dashboard dual-state removed |
| v5.1 | Real AI vision, localStorage auth replaced with /api/auth/me |
| v5.0 | Zero any in API routes, db-types.ts, GDPR routes, middleware security headers |
| v4 | Hardcoded encryption removed, leaderboard GDPR fix, dev bypass gated |
