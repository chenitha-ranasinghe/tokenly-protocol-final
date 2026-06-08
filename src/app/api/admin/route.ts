import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformMetrics } from '@/lib/db';
import { authenticateRequest, isAdmin } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';

async function requireAdmin(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user || !isAdmin(user)) return null;
  return user;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await getDb();
    const [usersCount, ordersCount, redemptionsCount, totalTrades, totalReviews] = await Promise.all([
      db.prepare('SELECT COUNT(*) as c FROM users').get() as Promise<{ c: number }>,
      db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status = 'open'`).get() as Promise<{ c: number }>,
      db.prepare(`SELECT COUNT(*) as c FROM redemptions WHERE status = 'pending'`).get() as Promise<{ c: number }>,
      db.prepare('SELECT COUNT(*) as c FROM trades').get() as Promise<{ c: number }>,
      db.prepare('SELECT COUNT(*) as c FROM reviews').get() as Promise<{ c: number }>,
    ]);
    const redemptions = await db.prepare('SELECT r.*, u.name as user_name, p.name as product_name FROM redemptions r JOIN users u ON r.user_id = u.id JOIN products p ON r.product_id = p.id ORDER BY r.created_at DESC LIMIT 20').all();
    // SECURITY: Never return private_key, password_hash, session_token
    const recentUsers = await db.prepare('SELECT id, name, email, points, experiment_group, total_reviews, rrs_score, is_banned, total_trades, created_at FROM users ORDER BY created_at DESC LIMIT 20').all();
    const canBonds = await db.prepare(`SELECT b.*, u.name as user_name, u.email as user_email, u.rrs_score FROM seller_bonds b JOIN users u ON b.user_id = u.id WHERE b.product_id = 'can_dao_node' ORDER BY b.created_at DESC`).all();
    const metrics = await getPlatformMetrics() as Record<string, unknown> | null;
    const totalSecuredValue = ((await db.prepare("SELECT SUM(consensus_price * total_tokens) as val FROM products WHERE verification_status = 'certified'").get()) as { val: number } | undefined)?.val || 0;
    return NextResponse.json({
      usersCount: (usersCount as unknown as { c: number })?.c || 0,
      ordersCount: (ordersCount as unknown as { c: number })?.c || 0,
      redemptionsCount: (redemptionsCount as unknown as { c: number })?.c || 0,
      totalTrades: (totalTrades as unknown as { c: number })?.c || 0,
      totalReviews: (totalReviews as unknown as { c: number })?.c || 0,
      redemptions, recentUsers, canBonds,
      tradingHalted: metrics?.trading_halted === 1,
      totalSecuredValue,
      platformMetrics: {
        totalFeesCollected: Math.round((metrics?.total_fees_collected as number) || 0),
        totalInsurancePool: Math.round((metrics?.total_insurance_pool as number) || 0),
        totalBurned: Math.round((metrics?.total_burned as number) || 0),
        totalBondsLocked: Math.round((metrics?.total_bonds_locked as number) || 0),
      },
    });
  } catch (error) {
    console.error('[Admin] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await getDb();
    const body = await request.json() as { action: string; targetUserId?: string; product?: Record<string, unknown>; reason?: string };
    const { action, targetUserId, product } = body;
    const ip = request.headers.get('x-forwarded-for') || 'unknown';

    switch (action) {
      case 'ban_user': {
        if (!targetUserId) return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
        const target = await db.prepare('SELECT is_admin FROM users WHERE id = ?').get(targetUserId) as { is_admin: number } | undefined;
        if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        if (target.is_admin) return NextResponse.json({ error: 'Cannot ban admin accounts' }, { status: 403 });
        await db.prepare('UPDATE users SET is_banned = 1 WHERE id = ?').run(targetUserId);
        await writeAuditLog('user_banned', admin.id as string, { targetId: targetUserId, targetType: 'user', details: { reason: body.reason || 'Admin action' }, ipAddress: ip });
        return NextResponse.json({ success: true });
      }
      case 'unban_user': {
        if (!targetUserId) return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
        await db.prepare('UPDATE users SET is_banned = 0 WHERE id = ?').run(targetUserId);
        await writeAuditLog('admin_action', admin.id as string, { targetId: targetUserId, targetType: 'user', details: { action: 'unban' }, ipAddress: ip });
        return NextResponse.json({ success: true });
      }
      case 'halt_trading': {
        await db.prepare('UPDATE platform_metrics SET trading_halted = 1 WHERE id = 1').run();
        await writeAuditLog('trading_halted', admin.id as string, { details: { halted: true }, ipAddress: ip });
        return NextResponse.json({ success: true });
      }
      case 'resume_trading': {
        await db.prepare('UPDATE platform_metrics SET trading_halted = 0 WHERE id = 1').run();
        await writeAuditLog('trading_halted', admin.id as string, { details: { halted: false }, ipAddress: ip });
        return NextResponse.json({ success: true });
      }
      case 'add_product': {
        if (!product?.name || !product?.brand || !product?.retail_price) return NextResponse.json({ error: 'Missing product fields' }, { status: 400 });
        const { v4: uuidv4 } = await import('uuid');
        const id = uuidv4();
        const sku = (product.sku as string) || `SKU-${Date.now()}`;
        const rp = product.retail_price as number;
        await db.prepare(`INSERT INTO products (id, name, brand, sku, retail_price, market_price_low, market_price_high, consensus_price, total_tokens, price_confidence, category, vault_location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(
            id,
            String(product.name),
            String(product.brand),
            sku,
            rp,
            Number(product.market_price_low) || rp * 0.9,
            Number(product.market_price_high) || rp * 1.1,
            Number(product.consensus_price) || rp,
            Number(product.total_tokens) || 1000,
            20,
            String(product.category || 'Sneakers'),
            String(product.vault_location || 'SG-MAIN')
          );
        await writeAuditLog('asset_approved', admin.id as string, { targetId: id, targetType: 'product', details: { name: product.name, brand: product.brand }, ipAddress: ip });
        return NextResponse.json({ success: true, id });
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Admin] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
