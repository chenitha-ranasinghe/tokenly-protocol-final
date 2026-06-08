import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest, isAdmin } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const userAuth = await authenticateRequest(request);
    if (!userAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Bulletproof God Mode Bypass
    if (isAdmin(userAuth)) {
      return NextResponse.json({ 
        success: true, 
        activeTiers: ['Network Inspector', 'Master Authenticator', 'Gemologist Partner'] 
      });
    }

    const db = await getDb();
    
    // 2. Regular User logic (database lookup)
    const activeBonds = await db.prepare("SELECT order_id FROM seller_bonds WHERE user_id = ? AND product_id = 'can_dao_node' AND status = 'locked'")
      .all(userAuth.id) as { order_id: string }[];
    
    console.log(`[CAN_STATUS] Found ${activeBonds.length} active bonds for user ${userAuth.email}`);
    
    const activeTierNames = activeBonds.map(b => b.order_id.replace('can_tier_', ''));

    return NextResponse.json({ 
      success: true, 
      activeTiers: activeTierNames,
      debug: { count: activeBonds.length } 
    });

  } catch (error) {
    console.error('CAN Status Error:', error);
    // Always return JSON
    return NextResponse.json({ error: 'System logic failure' }, { status: 500 });
  }
}
