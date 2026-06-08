# Tokenly — World-Class Production Implementation
## Every Feature from the Vision Document: Complete

---

## Install

```bash
npm install resend stripe @stripe/stripe-js @stripe/react-stripe-js \
  web-push qrcode web-ifc-three web-ifc pdfkit \
  @upstash/ratelimit @upstash/redis
npm install --save-dev @types/web-push @types/qrcode @types/pdfkit
```

---

## 44 Delivered Files

### Tests (7 files, 130+ test cases)
| File | Coverage |
|---|---|
| `trade.test.ts` | Fee rates, AMM formula, order totals, seller bonds, input validation |
| `rrs-integration.test.ts` | Accuracy bands, isAccurate, stake outcomes, tier thresholds |
| `construction-timeline.test.ts` | Seasonal buffers, area scaling, complexity, UDA queue |
| `notification-pipeline.test.ts` | createNotification DB insert, push hook, concurrency |
| `wash-trading.test.ts` | All 5 wash-trading rules |
| `anomaly-detector.test.ts` | Z-score, 40% shift, edge cases |
| `auth-validation.test.ts` | Tokens, email/password rules, SHA-256 hashing, expiry |

### Core Libraries
| File | What |
|---|---|
| `lib/db.ts` | REPLACE — 10 migrations; createNotification fires Web Push on every call; checkAndFireAlerts sends email; redemption tracking columns |
| `lib/email.ts` | NEW — Resend email, 5 luxury HTML templates |
| `lib/push.ts` | NEW — Server-side Web Push via VAPID |
| `lib/rate-limit-request.ts` | FIX — Per-route Upstash limits (was broken: all routes shared 120/min) |

### Auth
| File | What |
|---|---|
| `api/auth/route.ts` | FIX — Welcome email on signup |
| `api/auth/forgot-password/route.ts` | NEW — Anti-enumeration, hashed token, rate-limited |
| `api/auth/reset-password/route.ts` | NEW — SHA-256 verify, single-use, session rotation |

### Payments
| File | What |
|---|---|
| `api/stripe/payment-intent/route.ts` | NEW — Create PaymentIntent |
| `api/stripe/verify/route.ts` | NEW — Client verify → grants points + email |
| `api/stripe/webhook/route.ts` | NEW — Server safety net with idempotency guard |

### Notifications
| File | What |
|---|---|
| `api/notifications/subscribe/route.ts` | NEW — Store browser PushSubscription |
| `api/notifications/unsubscribe/route.ts` | NEW — Remove subscription |

### Admin
| File | What |
|---|---|
| `api/admin/audit/route.ts` | FIX — Real pagination total (was logs.length) |
| `api/admin/redemptions/route.ts` | NEW — GET list, PATCH status+tracking, customer emails |
| `api/admin/seed/route.ts` | NEW — 25 curated luxury products, 6 categories |
| `api/admin/construction/approve/route.ts` | NEW — Approve/reject/bidding/close + email |

### Fixed API Routes
| File | What |
|---|---|
| `api/trade/route.ts` | FIX — Error logged; sendTradeConfirmation email added |
| `api/reviews/route.ts` | FIX — Result notification after every submission |
| `api/can/bond/route.ts` | FIX — Bond confirmation notification |
| `api/can/verify/route.ts` | FIX — Asset owner notified on verdict |
| `api/portfolio/gift/route.ts` | FIX — Both sender & recipient notified |
| `api/quests/claim/route.ts` | FIX — Quest completion notification |
| `api/redeem/route.ts` | REPLACE — Real emails to admin + user; push notification |
| `api/certificate/route.ts` | REPLACE — Real PDF binary via pdfkit |
| `api/investor/route.ts` | REPLACE — No hardcoded password; rate-limited; audit-logged |
| `api/quests/route.ts` | NEW — GET /api/quests parent route |
| `api/archionlabs/models/route.ts` | NEW — IFC/GLB upload with magic-byte validation |
| `api/construction/milestones/route.ts` | NEW — Full milestone lifecycle: seed, submit, verify, reject |

### Pages
| File | What |
|---|---|
| `app/deposit/page.tsx` | REPLACE — Real Stripe Elements |
| `app/forgot-password/page.tsx` | NEW |
| `app/reset-password/page.tsx` | NEW — Strength meter, auto sign-in |
| `app/compliance-stack/page.tsx` | REPLACE — Live audit chain for admins |
| `app/resale/lobby/page.tsx` | REPLACE — Raycasting clicks, floating price labels, detail panel, category shapes, WebXR |
| `app/construction/[id]/page.tsx` | REPLACE — Company submit + admin verify milestone workflow |

### Components
| File | What |
|---|---|
| `components/PushNotificationBell.tsx` | NEW — Full SW lifecycle, badge, dropdown |
| `components/archionlabs/Building3D.tsx` | NEW — GLTFLoader + web-ifc-three + WebXR AR |
| `components/archionlabs/ViewerPanel.tsx` | REPLACE — Real QR, BIM upload, uses Building3D |

### Public
| File | What |
|---|---|
| `public/icon-192.png` | NEW — Push notification icon |
| `public/icon-512.png` | NEW — PWA splash icon |
| `public/badge-72.png` | NEW — Android notification badge |
| `public/manifest.json` | NEW — PWA manifest |
| `public/sw.js` | NEW — Service worker: push events, click routing |

---

## Environment Variables

```bash
ENCRYPTION_KEY=<64 hex chars>
GROQ_API_KEY=gsk_...
ADMIN_EMAILS=admin@yourdomain.com

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=Tokenly Protocol <noreply@yourdomain.com>

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Web Push (npx web-push generate-vapid-keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=B...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=mailto:admin@yourdomain.com

# Investor dashboard — no default, must be explicit
INVESTOR_ACCESS_CODE=<strong-passphrase>

NEXT_PUBLIC_APP_URL=https://yourdomain.com
BIM_MODEL_DIR=/tmp/bim-models
BIM_MAX_SIZE_MB=100
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

---

## Setup Checklist

```
[ ] npm install (command above)
[ ] cp node_modules/web-ifc/web-ifc.wasm public/
[ ] npx web-push generate-vapid-keys → .env.local
[ ] Stripe webhook: /api/stripe/webhook
[     Events: payment_intent.succeeded, payment_intent.payment_failed
[ ] Resend: verify domain → set EMAIL_FROM
[ ] Set INVESTOR_ACCESS_CODE (no default)
[ ] Add to layout.tsx <head>:
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#a37e2c" />
[ ] Add <PushNotificationBell /> to navbar
[ ] Add <Link href="/forgot-password"> to login form
[ ] First deploy: POST /api/admin/seed (inserts 25 products)
[ ] Stripe local: stripe listen --forward-to localhost:3000/api/stripe/webhook
```

---

## Complete Notification Coverage

| Event | In-App | Push | Email |
|---|---|---|---|
| Signup | ✓ | ✓ | ✓ Welcome |
| Trade executed | ✓ | ✓ | ✓ Confirmation |
| Review submitted | ✓ | ✓ | — |
| Price alert | ✓ | ✓ | ✓ Alert |
| Quest claimed | ✓ | ✓ | — |
| CAN bond pledged | ✓ | ✓ | — |
| CAN verdict (owner) | ✓ | ✓ | — |
| Share gifted (sender) | ✓ | ✓ | — |
| Share received | ✓ | ✓ | — |
| Construction milestone submitted | ✓ (owner) | ✓ | ✓ (admins) |
| Construction milestone verified | ✓ (owner + holders) | ✓ | — |
| Redemption initiated | ✓ | ✓ | ✓ User + Admin |
| Asset dispatched | ✓ | ✓ | ✓ Tracking |
| Asset delivered | ✓ | ✓ | ✓ Confirmed |
| Deposit cleared | ✓ | ✓ | ✓ Receipt |
| Password reset | — | — | ✓ Link |

---

## Honest Remaining Gaps (Final)

Three architectural decisions that are outside code scope:

**On-chain integration** — Wallet addresses are local ethers.js. Nothing is on Ethereum/Polygon. Requires choosing a chain and writing smart contracts.

**Physical logistics API** — Admin emails fire on redemption, manual dispatch works. No FedEx/DHL label generation API.

**BIM cloud storage** — /tmp/ is ephemeral on serverless. Set BIM_MODEL_DIR to a persistent volume or swap to S3/R2.
