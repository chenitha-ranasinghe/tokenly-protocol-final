/**
 * Tokenly Email Service — Production v1.0
 *
 * Powered by Resend (https://resend.com) — the modern transactional email API.
 * Falls back to console logging in development when RESEND_API_KEY is absent.
 *
 * Required environment variables:
 *   RESEND_API_KEY=re_xxxxxxxxxx          (from resend.com — free tier: 3,000 emails/month)
 *   EMAIL_FROM=noreply@yourdomain.com     (must be a verified sender domain in Resend)
 *   NEXT_PUBLIC_APP_URL=https://yourdomain.com
 *
 * Install dependency: npm install resend
 */

import { Resend } from 'resend';

// ─── Singleton Client ─────────────────────────────────────────────────────────

let _resend: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

const FROM   = process.env.EMAIL_FROM     || 'Tokenly Protocol <noreply@tokenly.luxury>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://tokenly.luxury';

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface EmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

// ─── Core Send Helper ─────────────────────────────────────────────────────────

async function send(to: string, subject: string, html: string): Promise<EmailResult> {
  const client = getResend();

  if (!client) {
    // Development fallback — safe to ignore in local/test environments
    console.info(`\n╔════════════════════════════════════════╗`);
    console.info(`║  [EMAIL DEV] To:      ${to.padEnd(17)}║`);
    console.info(`║  [EMAIL DEV] Subject: ${subject.substring(0, 17).padEnd(17)}║`);
    console.info(`╚════════════════════════════════════════╝`);
    console.info('Set RESEND_API_KEY in .env.local to send real emails.\n');
    return { ok: true, id: 'dev-console-fallback' };
  }

  try {
    const { data, error } = await client.emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error('[EMAIL] Resend delivery error:', error);
      return { ok: false, error: error.message };
    }
    console.info(`[EMAIL] Sent "${subject}" → ${to} (id: ${data?.id})`);
    return { ok: true, id: data?.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[EMAIL] Unexpected send error:', msg);
    return { ok: false, error: msg };
  }
}

// ─── HTML Template System ─────────────────────────────────────────────────────

/** Wraps any body content in the Tokenly-branded email shell. */
function shell(title: string, preheader: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <title>${title}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#050505;-webkit-text-size-adjust:100%;mso-line-height-rule:exactly;">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- ── HEADER ── -->
          <tr>
            <td style="background:#0a0a0a;border-top:2px solid #a37e2c;border-left:1px solid #1a1a1a;border-right:1px solid #1a1a1a;padding:28px 40px 24px;">
              <p style="margin:0 0 6px;font-family:'Courier New',Courier,monospace;font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:#a37e2c;">TOKENLY PROTOCOL</p>
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:300;letter-spacing:0.5px;color:#555;">The Global Liquidity Layer for Physical Assets</p>
            </td>
          </tr>

          <!-- ── BODY ── -->
          <tr>
            <td style="background:#0a0a0a;border-left:1px solid #1a1a1a;border-right:1px solid #1a1a1a;padding:36px 40px;">
              ${body}
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="background:#050505;border:1px solid #111;border-top:1px solid #1a1a1a;padding:24px 40px;">
              <p style="margin:0 0 6px;font-family:'Courier New',Courier,monospace;font-size:9px;letter-spacing:0.1em;color:#333;text-transform:uppercase;">
                Tokenly Protocol · Proof of Honest Experience
              </p>
              <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:9px;color:#222;line-height:1.6;">
                You are receiving this because you hold an account on the Tokenly network.<br/>
                If you did not request this message, you may safely disregard it.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Gold CTA button. */
function btn(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
    <tr>
      <td style="background:#a37e2c;">
        <a href="${url}" target="_blank"
           style="display:block;padding:14px 36px;font-family:'Courier New',Courier,monospace;font-size:10px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#000000;text-decoration:none;mso-padding-alt:14px 36px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

/** Section label in muted monospace. */
function lbl(text: string): string {
  return `<p style="margin:20px 0 3px;font-family:'Courier New',Courier,monospace;font-size:8px;letter-spacing:0.25em;text-transform:uppercase;color:#555;">${text}</p>`;
}

/** Value line — optionally gold. */
function val(text: string, gold = false): string {
  const color = gold ? '#a37e2c' : '#e0e0e0';
  const size  = gold ? '20px'    : '14px';
  return `<p style="margin:0 0 2px;font-family:'Courier New',Courier,monospace;font-size:${size};color:${color};">${text}</p>`;
}

/** 1px horizontal rule. */
const hr = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-top:1px solid #1c1c1c;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;

// ─── Email Templates ──────────────────────────────────────────────────────────

/**
 * Sent immediately after a new account is created.
 */
export async function sendWelcomeEmail(params: {
  email: string;
  name: string;
  walletAddress: string;
  points: number;
  experimentGroup: 'staking' | 'control';
}): Promise<EmailResult> {
  const cohortLabel = params.experimentGroup === 'staking'
    ? 'Staking Cohort — Review & Earn'
    : 'Control Cohort — Standard Access';

  const addrShort = `${params.walletAddress.slice(0, 10)}...${params.walletAddress.slice(-8)}`;

  const body = `
    <h1 style="margin:0 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:28px;font-weight:300;letter-spacing:-0.5px;color:#ffffff;">Welcome, ${params.name}.</h1>
    <p style="margin:0 0 28px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.75;color:#777;">
      Your account is now live on the global liquidity layer for physical assets.<br/>
      We have credited your starting balance and assigned your research cohort.
    </p>
    ${hr}
    ${lbl('Protocol Account')} ${val(params.name)}
    ${lbl('Network Wallet')}   ${val(addrShort)}
    ${lbl('Opening Balance')}  ${val(params.points.toLocaleString() + ' PTS', true)}
    ${lbl('Research Cohort')}  ${val(cohortLabel)}
    ${hr}
    <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#666;">
      Browse the vault marketplace, authenticate physical assets using our AI scanner,<br/>
      or trade fractional tokens. Your Reviewer Reputation Score (RRS) grows with every<br/>
      accurate review you submit.
    </p>
    ${btn('ENTER THE VAULT', `${APP_URL}/dashboard`)}
  `;

  return send(
    params.email,
    'Welcome to Tokenly — Your protocol account is ready',
    shell('Welcome to Tokenly', `You have been granted ${params.points.toLocaleString()} PTS to start trading and reviewing.`, body)
  );
}

/**
 * Sent after every successful buy or sell trade execution.
 */
export async function sendTradeConfirmation(params: {
  email: string;
  name: string;
  tradeType: 'buy' | 'sell';
  shares: number;
  productName: string;
  brand: string;
  pricePerShare: number;
  totalCost: number;
  feePaid: number;
  tradeId: string;
}): Promise<EmailResult> {
  const action = params.tradeType === 'buy' ? 'PURCHASED' : 'SOLD';

  const body = `
    <h1 style="margin:0 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:28px;font-weight:300;letter-spacing:-0.5px;color:#ffffff;">Trade Executed.</h1>
    <p style="margin:0 0 28px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.75;color:#777;">
      Your ${params.tradeType} order has been matched and filled on the Tokenly order book.
    </p>
    ${hr}
    ${lbl('Action')}           ${val(action)}
    ${lbl('Asset')}            ${val(`${params.brand} ${params.productName}`)}
    ${lbl('Shares')}           ${val(params.shares.toLocaleString())}
    ${lbl('Price Per Share')}  ${val('$' + params.pricePerShare.toLocaleString())}
    ${lbl('Total Value')}      ${val('$' + params.totalCost.toLocaleString(), true)}
    ${lbl('Protocol Fee')}     ${val('$' + params.feePaid.toFixed(2))}
    ${hr}
    <p style="margin:0 0 4px;font-family:'Courier New',Courier,monospace;font-size:8px;letter-spacing:0.25em;text-transform:uppercase;color:#333;">Trade Reference</p>
    <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:10px;color:#444;word-break:break-all;">${params.tradeId}</p>
    ${btn('VIEW PORTFOLIO', `${APP_URL}/portfolio`)}
  `;

  return send(
    params.email,
    `Trade Confirmed: ${action} ${params.shares} × ${params.brand} ${params.productName}`,
    shell('Trade Confirmation', `${action} ${params.shares} shares at $${params.pricePerShare.toLocaleString()} per share.`, body)
  );
}

/**
 * Sent when a user's price alert is triggered by a live trade.
 */
export async function sendPriceAlertEmail(params: {
  email: string;
  name: string;
  productName: string;
  brand: string;
  targetPrice: number;
  currentPrice: number;
  direction: 'above' | 'below';
  productId: string;
}): Promise<EmailResult> {
  const crossed = params.direction === 'above' ? 'risen above' : 'fallen below';
  const delta   = Math.abs(params.currentPrice - params.targetPrice);
  const pct     = ((delta / params.targetPrice) * 100).toFixed(1);

  const body = `
    <h1 style="margin:0 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:28px;font-weight:300;letter-spacing:-0.5px;color:#ffffff;">Price Alert Triggered.</h1>
    <p style="margin:0 0 28px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.75;color:#777;">
      An asset you are monitoring has ${crossed} your target price.
    </p>
    ${hr}
    ${lbl('Asset')}          ${val(`${params.brand} ${params.productName}`)}
    ${lbl('Your Target')}    ${val('$' + params.targetPrice.toLocaleString() + ' (' + params.direction + ')')}
    ${lbl('Current Price')}  ${val('$' + params.currentPrice.toLocaleString(), true)}
    ${lbl('Deviation')}      ${val(pct + '% from target')}
    ${hr}
    <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#555;">
      This alert has been automatically deactivated. Set a new one from the asset page.
    </p>
    ${btn('TRADE NOW', `${APP_URL}/vault/${params.productId}`)}
  `;

  return send(
    params.email,
    `Alert: ${params.brand} ${params.productName} is now $${params.currentPrice.toLocaleString()}`,
    shell('Price Alert', `${params.brand} ${params.productName} has ${crossed} $${params.targetPrice.toLocaleString()}.`, body)
  );
}

/**
 * Sent when a user requests a password reset.
 * Contains a single-use link valid for 15 minutes.
 */
export async function sendPasswordResetEmail(params: {
  email: string;
  name: string;
  resetToken: string;
  expiresInMinutes?: number;
}): Promise<EmailResult> {
  const mins    = params.expiresInMinutes ?? 15;
  const resetUrl = `${APP_URL}/reset-password?token=${params.resetToken}`;

  const body = `
    <h1 style="margin:0 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:28px;font-weight:300;letter-spacing:-0.5px;color:#ffffff;">Password Reset.</h1>
    <p style="margin:0 0 28px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.75;color:#777;">
      We received a request to reset the password for <strong style="color:#e0e0e0;">${params.email}</strong>.<br/>
      If you did not initiate this, please ignore this email — your account remains secure.
    </p>
    ${hr}
    <p style="margin:0 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#999;line-height:1.6;">
      Click the button below to choose a new password.<br/>
      This link is <strong style="color:#ffffff;">single-use</strong> and expires in <strong style="color:#ffffff;">${mins} minutes</strong>.
    </p>
    ${btn('RESET MY PASSWORD', resetUrl)}
    ${hr}
    <p style="margin:0 0 6px;font-family:'Courier New',Courier,monospace;font-size:8px;letter-spacing:0.2em;text-transform:uppercase;color:#333;">Direct Link</p>
    <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:10px;color:#444;word-break:break-all;">${resetUrl}</p>
    ${hr}
    <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#444;line-height:1.6;">
      For your security: never share this link. Tokenly staff will never ask for it.
    </p>
  `;

  return send(
    params.email,
    'Tokenly — Password Reset Request',
    shell('Password Reset', `A password reset link has been issued. It expires in ${mins} minutes.`, body)
  );
}

/**
 * Sent after a successful Stripe deposit clears and points are credited.
 */
export async function sendDepositConfirmation(params: {
  email: string;
  name: string;
  amountUSD: number;
  pointsGranted: number;
  paymentIntentId: string;
}): Promise<EmailResult> {
  const body = `
    <h1 style="margin:0 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:28px;font-weight:300;letter-spacing:-0.5px;color:#ffffff;">Deposit Confirmed.</h1>
    <p style="margin:0 0 28px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.75;color:#777;">
      Your payment has cleared and your Tokenly protocol balance has been updated.
    </p>
    ${hr}
    ${lbl('Amount Paid')}         ${val('$' + params.amountUSD.toFixed(2) + ' USD')}
    ${lbl('Points Credited')}     ${val(params.pointsGranted.toLocaleString() + ' PTS', true)}
    ${lbl('Conversion Rate')}     ${val('$1.00 USD = 100 PTS')}
    ${hr}
    <p style="margin:0 0 4px;font-family:'Courier New',Courier,monospace;font-size:8px;letter-spacing:0.25em;text-transform:uppercase;color:#333;">Payment Reference</p>
    <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:10px;color:#444;word-break:break-all;">${params.paymentIntentId}</p>
    ${btn('VIEW DASHBOARD', `${APP_URL}/dashboard`)}
  `;

  return send(
    params.email,
    `Tokenly — Deposit of $${params.amountUSD.toFixed(2)} confirmed`,
    shell('Deposit Confirmed', `$${params.amountUSD.toFixed(2)} deposited. ${params.pointsGranted.toLocaleString()} PTS credited to your account.`, body)
  );
}
