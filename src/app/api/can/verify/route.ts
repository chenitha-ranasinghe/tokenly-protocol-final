import { NextRequest, NextResponse } from 'next/server';
import { getDb, createNotification } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import crypto from 'crypto';
import { getUserCANBenefits } from '@/lib/can';

export async function POST(request: NextRequest) {
  try {
    const userAuth = await authenticateRequest(request);
    if (!userAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { productId, verdict, notes } = body;

    if (!productId || !verdict) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const db = await getDb();
    
    // Authorization check
    const { isAdmin } = await import('@/lib/session');
    const isGodMode = isAdmin(userAuth);
    if (!isGodMode) {
      const activeBond = await db.prepare("SELECT id FROM seller_bonds WHERE user_id = ? AND product_id = 'can_dao_node' AND status = 'locked' LIMIT 1")
        .get(userAuth.id);
      if (!activeBond) return NextResponse.json({ error: 'Clearance level insufficient.' }, { status: 403 });
    }

        const ts = "datetime('now')";
    
    // Get CAN benefits for reward
    const canBenefits = await getUserCANBenefits(userAuth.id);
    const verificationReward = Math.round(50 * canBenefits.multiplier); // Base 50 pts * multiplier

    const product = await db.prepare('SELECT retail_price, name FROM products WHERE id = ?').get(productId) as
      | { retail_price?: number; name?: string }
      | undefined;
    const isHighValue = (product?.retail_price ?? 0) > 2000;
    const certId = `CERT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    // PERFECTION: Generate Immutable Verification Hash (SHA-256)
    const verificationHash = crypto.createHash('sha256')
      .update(`${productId}-${userAuth.id}-${verdict}-${ts}`)
      .digest('hex');
    
    // Determine Grade based on tier
    const grade = isHighValue ? 3 : ((product?.retail_price ?? 0) > 200 ? 2 : 1);

    await db.transaction(async (txDb) => {
      // 1. Record the authentication verdict with cryptographic hash
      await txDb.prepare(`
        INSERT INTO authentications (id, user_id, product_id, verdict, notes, created_at, cert_id, confidence_score, status, verification_hash, grade)
        VALUES (?, ?, ?, ?, ?, ${ts}, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), userAuth.id, productId, verdict, notes || '', certId, 95.5, 1, verificationHash, grade);

      // 2. Pay the Verification Yield
      await txDb.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(verificationReward, userAuth.id);
      await txDb.prepare(`INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, 'verification_yield', ?)`)
        .run(crypto.randomUUID(), userAuth.id, verificationReward, `Professional yield for authenticating ${product?.name || productId} (${canBenefits.name})`);

      // 3. Update product status if consensus reached
      const allVerdicts = await txDb.prepare('SELECT verdict FROM authentications WHERE product_id = ?').all(productId) as {verdict: string}[];
      const authenticCount = allVerdicts.filter(v => v.verdict === 'authentic').length;
      
      if (verdict === 'synthetic') {
        await txDb.prepare(`UPDATE products SET verification_status = 'rejected' WHERE id = ?`).run(productId);
      } else {
        // PERFECTION LOGIC: High value (> $2,000) needs 2 nodes OR 1 Admin. Standard needs 1 node.
        const consensusReached = isGodMode || (!isHighValue && authenticCount >= 1) || (isHighValue && authenticCount >= 2);
        
        if (consensusReached) {
          await txDb.prepare(`UPDATE products SET verification_status = 'certified' WHERE id = ?`).run(productId);
          // Set all related authentications to Completed (1) and record final hash
          await txDb.prepare(`UPDATE authentications SET status = 1 WHERE product_id = ?`).run(productId);
          console.log(`[CONSENSUS] Product ${productId} certified with hash ${verificationHash.slice(0, 8)}...`);
        }
      }
    });

    // Notify the asset owner of the verification verdict (non-blocking)
    try {
      const assetOwner = await db.prepare(
        'SELECT DISTINCT user_id FROM user_shares WHERE product_id = ? AND shares > 0 LIMIT 1'
      ).get(productId) as { user_id: string } | undefined;

      if (assetOwner && assetOwner.user_id !== String(userAuth.id)) {
        const verdictLabel = verdict === 'authentic' ? 'Certified Authentic ✓' : 'Verdict: Synthetic/Rejected';
        const notifBody = verdict === 'authentic'
          ? `Your asset "${product?.name || productId}" has been authenticated by a CAN node. Certificate ID: ${certId}.`
          : `A CAN node submitted a non-authentic verdict for "${product?.name || productId}". Check your vault for details.`;
        createNotification(assetOwner.user_id, verdictLabel, notifBody, 'system', '/portfolio').catch(() => {});
      }
    } catch { /* non-fatal */ }

    const updatedUser = await db.prepare('SELECT id, points FROM users WHERE id = ?').get(userAuth.id);

    return NextResponse.json({ 
      success: true, 
      message: 'Verdict recorded. Treasury updated.', 
      reward: verificationReward,
      user: updatedUser 
    });

  } catch (error: unknown) {
    console.error('CAN Verify Error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('UNIQUE constraint')) {
        return NextResponse.json({ error: 'You have already submitted a verdict for this asset.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
