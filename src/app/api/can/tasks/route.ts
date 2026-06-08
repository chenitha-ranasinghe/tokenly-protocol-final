import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const userAuth = await authenticateRequest(request);
    if (!userAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { isAdmin } = await import('@/lib/session');
    const isGodMode = isAdmin(userAuth);

    const db = await getDb();
    
    // Check if user has ANY active CAN bond (unless God Mode)
    if (!isGodMode) {
      const activeBond = await db.prepare("SELECT id FROM seller_bonds WHERE user_id = ? AND product_id = 'can_dao_node' AND status = 'locked' LIMIT 1")
        .get(userAuth.id);
      
      if (!activeBond) {
        return NextResponse.json({ error: 'Verification Hub access restricted to active CAN nodes.' }, { status: 403 });
      }
    }

    // Fetch products currently awaiting verification
    const tasks = await db.prepare(`
      SELECT * FROM products 
      WHERE verification_status = 'pending' 
      ORDER BY created_at DESC
    `).all();

    return NextResponse.json({ success: true, tasks });

  } catch (error) {
    console.error('CAN Tasks Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
