/**
 * GET /api/certificate?productId=xxx
 *
 * Generates and streams a real PDF Certificate of Authenticity using pdfkit.
 * Previously returned HTML with a "print to PDF" button — now returns an
 * actual binary PDF that browsers download directly.
 *
 * Install: npm install pdfkit
 * Types:   npm install --save-dev @types/pdfkit
 *
 * The PDF includes:
 *  - Gold-bordered certificate design
 *  - Asset details (name, SKU, brand, category, vault location)
 *  - CAN verification status and authenticator count
 *  - Holder name and verification hash
 *  - Protocol seal and signatures
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import type { User, Product } from '@/lib/types';

// ── PDF generation ────────────────────────────────────────────────────────────

async function buildCertificatePDF(params: {
  user:            User;
  product:         Product;
  authenticators:  number;
  verificationHash: string;
  issuedAt:        string;
}): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size:   'A4',
      margin: 0,
      info: {
        Title:   `Certificate of Authenticity — ${params.product.name}`,
        Author:  'Tokenly Protocol',
        Subject: 'Physical Asset Certificate of Authenticity',
        Creator: 'Tokenly Protocol v1.0',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data',  (chunk: Buffer) => chunks.push(chunk));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;   // 595.28
    const H = doc.page.height;  // 841.89
    const GOLD  = '#A37E2C';
    const GOLD2 = '#F4D03F';
    const DARK  = '#050505';
    const MID   = '#0A0A0A';
    const GREY  = '#666666';
    const WHITE = '#FFFFFF';

    // ── Background ──────────────────────────────────────────────────────────
    doc.rect(0, 0, W, H).fill(DARK);

    // ── Outer gold border ───────────────────────────────────────────────────
    const bm = 28;
    doc.rect(bm, bm, W - bm * 2, H - bm * 2)
      .lineWidth(2)
      .strokeColor(GOLD)
      .stroke();

    // ── Inner thin border ───────────────────────────────────────────────────
    const bm2 = 36;
    doc.rect(bm2, bm2, W - bm2 * 2, H - bm2 * 2)
      .lineWidth(0.5)
      .strokeColor(GOLD2)
      .fillOpacity(0)
      .stroke();
    doc.fillOpacity(1);

    // ── Corner ornaments ────────────────────────────────────────────────────
    const corners = [[bm, bm], [W-bm, bm], [bm, H-bm], [W-bm, H-bm]] as [number, number][];
    corners.forEach(([x, y]) => {
      doc.circle(x, y, 5).fillColor(GOLD).fill();
    });

    // ── Header section ──────────────────────────────────────────────────────
    let y = 70;

    // Protocol label
    doc
      .fontSize(7)
      .font('Helvetica')
      .fillColor(GOLD)
      .text('TOKENLY PROTOCOL · AUTHENTICATION DIVISION', 0, y, { align: 'center', characterSpacing: 3 });

    y += 18;

    // Decorative line
    doc.moveTo(bm2 + 20, y).lineTo(W - bm2 - 20, y).lineWidth(0.5).strokeColor(GOLD).stroke();
    y += 20;

    // CERTIFICATE heading
    doc
      .fontSize(38)
      .font('Helvetica-Bold')
      .fillColor(WHITE)
      .text('CERTIFICATE', 0, y, { align: 'center', characterSpacing: 8 });

    y += 44;

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(GREY)
      .text('OF AUTHENTICITY & OWNERSHIP', 0, y, { align: 'center', characterSpacing: 4 });

    y += 28;

    // Star seal (SVG-like with pdfkit primitives)
    const cx = W / 2, cy2 = y + 28;
    const spikes = 8, or = 22, ir = 11;
    doc.save();
    doc.strokeColor(GOLD).lineWidth(1);
    let pathStarted = false;
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (Math.PI / spikes) * i - Math.PI / 2;
      const r     = i % 2 === 0 ? or : ir;
      const px    = cx + Math.cos(angle) * r;
      const py    = cy2 + Math.sin(angle) * r;
      if (!pathStarted) { doc.moveTo(px, py); pathStarted = true; }
      else              { doc.lineTo(px, py); }
    }
    doc.closePath().stroke();
    doc.circle(cx, cy2, 14).strokeColor(GOLD).lineWidth(0.5).stroke();
    doc.restore();

    y = cy2 + 38;

    // ── Holder declaration ──────────────────────────────────────────────────
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor(GREY)
      .text('This certifies that', 0, y, { align: 'center' });

    y += 16;

    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .fillColor(WHITE)
      .text(String(params.user.name || params.user.email), 0, y, { align: 'center' });

    y += 20;

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(GREY)
      .text('is the verified holder of the digital vault token representing the physical asset:', 0, y, { align: 'center' });

    y += 24;

    // ── Asset info block ────────────────────────────────────────────────────
    const bx = bm2 + 24, bw = W - (bm2 + 24) * 2;
    doc.rect(bx, y, bw, 170).fillColor(MID).fill();
    doc.rect(bx, y, bw, 170).lineWidth(0.5).strokeColor(GOLD).fillOpacity(0).stroke();
    doc.fillOpacity(1);

    // Gold top bar on asset block
    doc.rect(bx, y, bw, 2).fillColor(GOLD).fill();

    y += 16;

    // Asset name
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .fillColor(WHITE)
      .text(String(params.product.name), bx + 20, y, { width: bw - 40, align: 'center' });

    y += 30;

    doc
      .fontSize(8)
      .font('Courier')
      .fillColor(GOLD)
      .text(`BRAND: ${params.product.brand}  ·  SKU: ${params.product.sku}`, 0, y, { align: 'center', characterSpacing: 1 });

    y += 28;

    // 2x2 info grid
    const gridW = bw / 2 - 10;
    const cells = [
      ['CAN VERIFICATION',   params.authenticators > 0 ? `CERTIFIED AUTHENTIC (${params.authenticators} auditors)` : 'PENDING CAN REVIEW'],
      ['VAULT LOCATION',     String(params.product.vault_location || 'SG-MAIN · Singapore')],
      ['CONSENSUS VALUE',    `$${Number(params.product.consensus_price).toLocaleString()} PTS`],
      ['INSURANCE STATUS',   'ACTIVE · Tokenly Protocol Coverage'],
    ] as const;

    cells.forEach((cell, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const gx  = bx + 20 + col * (gridW + 10);
      const gy  = y + row * 44;

      doc.fontSize(7).font('Helvetica').fillColor(GREY)
        .text(cell[0], gx, gy, { characterSpacing: 1 });

      const isAuth = i === 0;
      doc.fontSize(9).font('Helvetica-Bold')
        .fillColor(isAuth ? (params.authenticators > 0 ? '#27AE60' : GOLD) : WHITE)
        .text(cell[1], gx, gy + 10, { width: gridW - 10 });
    });

    y += 100;

    // ── Issued / date line ──────────────────────────────────────────────────
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor(GREY)
      .text(`Issued: ${params.issuedAt}`, bm2 + 24, y, { align: 'left', width: bw });

    // ── Divider ─────────────────────────────────────────────────────────────
    y += 20;
    doc.moveTo(bm2 + 20, y).lineTo(W - bm2 - 20, y).lineWidth(0.5).strokeColor(GOLD).stroke();
    y += 18;

    // ── Signature lines ─────────────────────────────────────────────────────
    const sigW = 140, sigGap = (W - bm2 * 2 - sigW * 2) / 3;
    const sigPositions = [bm2 + sigGap, bm2 + sigGap + sigW + sigGap + sigW / 2 + 20];

    [['Protocol Auditor', 'Tokenly CAN Division'], ['Node Custodian', 'Vault Operations']]
      .forEach(([role, dept], i) => {
        const sx = sigPositions[i];
        doc.moveTo(sx, y + 18).lineTo(sx + sigW, y + 18).lineWidth(0.5).strokeColor(GREY).stroke();
        doc.fontSize(7).font('Helvetica').fillColor(GREY)
          .text(role, sx, y + 22, { width: sigW, align: 'center' });
        doc.fontSize(6).font('Helvetica').fillColor('#444444')
          .text(dept, sx, y + 32, { width: sigW, align: 'center' });
      });

    y += 56;

    // ── Verification hash ───────────────────────────────────────────────────
    doc
      .fontSize(6)
      .font('Courier')
      .fillColor('#333333')
      .text(`Verification Hash: ${params.verificationHash}`, 0, y, {
        align:     'center',
        width:     W,
        characterSpacing: 0.5,
      });

    y += 12;

    doc
      .fontSize(6)
      .font('Helvetica')
      .fillColor('#2a2a2a')
      .text(
        'This certificate is cryptographically bound to the Tokenly audit chain. ' +
        'Verify at tokenly.luxury/explorer',
        0, y, { align: 'center', width: W }
      );

    doc.end();
  });
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await authenticateRequest(request) as User | null;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const productId = searchParams.get('productId');
    if (!productId) return NextResponse.json({ error: 'Product ID required' }, { status: 400 });

    const db = await getDb();

    const share = await db
      .prepare('SELECT * FROM user_shares WHERE user_id = ? AND product_id = ?')
      .get(user.id, productId) as { shares: number } | undefined;

    if (!share || share.shares <= 0) {
      return NextResponse.json(
        { error: 'Only asset holders can generate a Certificate of Authenticity.' },
        { status: 403 }
      );
    }

    const product = await db
      .prepare('SELECT * FROM products WHERE id = ?')
      .get(productId) as Product | undefined;

    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const authentications = await db
      .prepare("SELECT verification_hash FROM authentications WHERE product_id = ? AND verdict = 'authentic'")
      .all(productId) as { verification_hash?: string }[];

    const verificationHash = authentications[0]?.verification_hash
      ?? `TLY-${Buffer.from(productId).toString('hex').slice(0, 32).toUpperCase()}`;

    const issuedAt = new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    // Generate real PDF
    const pdfBuffer = await buildCertificatePDF({
      user,
      product,
      authenticators:  authentications.length,
      verificationHash,
      issuedAt,
    });

    const filename = `Tokenly-Certificate-${String(product.sku).replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length':      String(pdfBuffer.length),
        'Cache-Control':       'private, no-store',
      },
    });
  } catch (error) {
    console.error('[CERTIFICATE] Error:', error);

    // If pdfkit is not installed, return helpful error
    if (error instanceof Error && error.message.includes('Cannot find module')) {
      return NextResponse.json(
        { error: 'PDF generation requires pdfkit. Run: npm install pdfkit' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: 'Failed to generate certificate.' }, { status: 500 });
  }
}
