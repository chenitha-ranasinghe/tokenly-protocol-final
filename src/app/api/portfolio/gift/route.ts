import { NextRequest, NextResponse } from 'next/server';
import { getDb, createNotification } from '@/lib/db';
import { enforceRateLimit } from '@/lib/rate-limit-request';
import { jsonError } from '@/lib/api-response';
import { authenticateRequest } from '@/lib/session';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');

    const rl = await enforceRateLimit(req, `portfolio:gift:${user.id}`, 20, 60);
    if (rl) return rl;

    const body = await req.json();
    const { productId, recipientEmail, shares } = body;
    
    if (!productId || !recipientEmail || !shares || shares <= 0) {
        return jsonError('Invalid gifting parameters.', 400, 'BAD_REQUEST');
    }

    if (user.email === recipientEmail) {
        return jsonError('You cannot gift shares to yourself.', 400, 'BAD_REQUEST');
    }

    const db = await getDb();
    
    // Check if recipient exists
    const recipient = await db.prepare('SELECT * FROM users WHERE email = ?').get(recipientEmail) as Record<string, unknown> | undefined;
    if (!recipient) {
        return jsonError('Recipient email not found on Tokenly. They must create an account first.', 404, 'NOT_FOUND');
    }

    const giftProduct = await db.prepare('SELECT name, brand FROM products WHERE id = ?').get(productId) as
      | { name: string; brand: string }
      | undefined;
    const productLabel = giftProduct ? `${giftProduct.brand} ${giftProduct.name}` : productId;

    try {
        await db.transaction(async (txDb) => {
            // Check sender shares
            const senderShare = await txDb.prepare('SELECT * FROM user_shares WHERE user_id = ? AND product_id = ?').get(user.id, productId) as
              | { id: string; shares: number; avg_buy_price: number }
              | undefined;
            if (!senderShare || senderShare.shares < shares) {
                throw new Error('Insufficient shares to gift.');
            }

            // Subtract from sender
            await txDb.prepare('UPDATE user_shares SET shares = shares - ? WHERE id = ?').run(shares, senderShare.id);
            await txDb.prepare('DELETE FROM user_shares WHERE shares <= 0').run(); // cleanup

            // Add to recipient
            const recipientShare = await txDb.prepare('SELECT * FROM user_shares WHERE user_id = ? AND product_id = ?').get(String(recipient.id), productId) as
              | { id: string }
              | undefined;
            if (recipientShare) {
                 await txDb.prepare('UPDATE user_shares SET shares = shares + ? WHERE id = ?').run(shares, recipientShare.id);
            } else {
                 await txDb.prepare('INSERT INTO user_shares (id, user_id, product_id, shares, avg_buy_price) VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), String(recipient.id), productId, shares, senderShare.avg_buy_price);
            }

            // Log transactions
            await txDb.prepare('INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)')
                .run(crypto.randomUUID(), user.id, 0, 'refund', `Gifted ${shares} shares to ${recipientEmail}`);
                
            await txDb.prepare('INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)')
                .run(crypto.randomUUID(), String(recipient.id), 0, 'deposit', `Received gift of ${shares} shares from ${user.email}`);
        });
    } catch (err) { 
        return jsonError('Gift transfer failed. Please check recipient details.', 400, 'BAD_REQUEST'); 
    }

    // Notify sender (in-app + push)
    createNotification(
      String(user.id),
      'Shares Gifted',
      `You gifted ${shares} share${shares > 1 ? 's' : ''} of ${productLabel} to ${recipientEmail}.`,
      'trade',
      '/portfolio'
    ).catch(() => {});

    // Notify recipient (in-app + push)
    createNotification(
      String(recipient.id),
      'Shares Received',
      `${user.name || user.email} gifted you ${shares} share${shares > 1 ? 's' : ''} of ${productLabel}. Check your portfolio.`,
      'trade',
      '/portfolio'
    ).catch(() => {});

    return NextResponse.json({ success: true, message: `Successfully gifted ${shares} shares to ${recipientEmail}!` });

  } catch (error) {
    console.error('Gift Route Error:', error);
    return jsonError('Gift transfer failed. Please try again.', 500, 'INTERNAL');
  }
}
