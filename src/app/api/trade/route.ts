// Import core Next.js routing request and response helper classes.
import { NextRequest, NextResponse } from 'next/server';

// Import database client, trading halt check, and metrics logger utility functions.
import { getDb, isTradingHalted, recordTradeMetrics } from '@/lib/db';

// Import crypto module to generate random order and bond UUIDs.
import crypto from 'crypto';

// Import the reputation tier matching formula from Reviewer Reputation Score service.
import { getTier } from '@/lib/rrs';

// Import wash trading cooldown and self-trade checks.
import { checkWashTrading, isSelfTrade } from '@/lib/wash-trading';

// Import authentication helper to resolve active sessions.
import { authenticateRequest } from '@/lib/session';

// Import compliance audit logging function.
import { writeAuditLog } from '@/lib/audit';

// Import network inspector discount benefits solver.
import { getUserCANBenefits } from '@/lib/can';

// Import user notification creator utility.
import { createNotification } from '@/lib/db';

// Import typing structures to enforce TypeScript compile safety.
import { User, Product, Order, UserShare } from '@/lib/types';

// Import rate-limiting helper to block API spam.
import { enforceRateLimit } from '@/lib/rate-limit-request';

// Import API standard error-formatter.
import { jsonError } from '@/lib/api-response';

/**
 * Handles trade execution requests (POST /api/trade)
 * Resolves buy/sell orders against the open orderbook, falling back to a virtual AMM if needed.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Resolve user profile session. Reject if unauthorized.
    const _user = await authenticateRequest(req);
    if (!_user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');
    const user = _user as User;

    // 2. Enforce API request rate limit: max 45 requests per 60 seconds.
    const rl = await enforceRateLimit(req, `trade:post:${user.id}`, 45, 60);
    if (rl) return rl;
    
    // 3. Resolve if the user has administrator ("God Mode") permissions.
    const { isAdmin } = await import('@/lib/session');
    const isGodMode = isAdmin(user);

    // 4. If trading is globally frozen, block transactions (admins bypass this halt).
    if (!isGodMode && await isTradingHalted()) {
      return jsonError('Trading is temporarily halted by the network administrator.', 503, 'SERVICE_UNAVAILABLE');
    }
    
    // 5. Establish database connection.
    const db = await getDb();

    // 6. Extract payload body properties.
    const body = await req.json() as Record<string, unknown>;
    const productId = typeof body.productId === 'string' ? body.productId : '';
    const type = body.type === 'buy' || body.type === 'sell' ? body.type : null;
    const shares = typeof body.shares === 'number' ? body.shares : NaN;
    const isLimit = Boolean(body.isLimit);
    const targetPrice = typeof body.targetPrice === 'number' ? body.targetPrice : null;

    // 7. Validate baseline trading input requirements.
    if (!productId || !type || !Number.isFinite(shares) || shares <= 0) {
      return jsonError('Invalid trade parameters', 400, 'BAD_REQUEST');
    }

    // 8. Security Check: Enforce integer shares (no fractional input spam) and cap trade sizes at 10,000.
    const safeShares = Math.floor(shares);
    if (safeShares !== shares || safeShares > 10000) {
      return jsonError('Shares must be a whole number between 1 and 10,000', 400, 'BAD_REQUEST');
    }

    // 9. Validate limit price target parameters.
    if (isLimit && (!targetPrice || targetPrice <= 0)) {
      return jsonError('Invalid limit price', 400, 'BAD_REQUEST');
    }

    // 10. Verify that the product is actively listed in the catalog database.
    const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as Product | undefined;
    if (!product) return jsonError('Product not found', 404, 'NOT_FOUND');

    // 11. Retrieve current price (consensus or retail fallback). Abort if zero or market closed.
    const currentPrice = product.consensus_price || product.retail_price;
    if (!currentPrice || currentPrice <= 0) {
      return jsonError('Market is closed for this asset', 400, 'BAD_REQUEST');
    }

    // 12. Run Wash Trading Checks (rate cooldown, price deviation caps, volume spikes; admins bypass).
    const executionPrice = isLimit ? (targetPrice as number) : currentPrice;
    const washCheck = await checkWashTrading(user.id, productId, type, shares, executionPrice);
    if (!isGodMode && !washCheck.allowed) {
      return jsonError(washCheck.reason ?? 'Wash trading check failed', 429, 'RATE_LIMITED');
    }

    // 13. Resolve custom transaction fee rates based on RRS tier discounts (admins pay zero).
    const rrsTier = getTier(user.rrs_score || 50);
    let feeRate = isGodMode ? 0 : 0.03; // Default starting rate is 3% fee
    if (!isGodMode) {
      if (rrsTier === 'Verified Elite') feeRate = 0; // Top tier pays 0% fee
      else if (rrsTier === 'Expert') feeRate = 0.005; // Expert pays 0.5% fee
      else if (rrsTier === 'Trusted') feeRate = 0.01;  // Trusted pays 1.0% fee
      else if (rrsTier === 'Reviewer') feeRate = 0.02; // Reviewer pays 2.0% fee

      // Apply network node authenticators stacking discount deductions.
      const canBenefits = await getUserCANBenefits(user.id);
      feeRate = Math.max(0, feeRate * (1 - canBenefits.feeReduction));
    }

    // 14. Calculate financial splits: base value + fees + 0.1% insurance fee pool allocation.
    const insuranceRate = isGodMode ? 0 : 0.001; 
    const baseAmount = (shares as number) * (isLimit ? (targetPrice as number) : currentPrice);
    const feeAmount = Math.round(baseAmount * feeRate);
    const insuranceFee = Math.round(baseAmount * insuranceRate);
    const totalCostOrRevenue = type === 'buy' ? baseAmount + feeAmount + insuranceFee : baseAmount - feeAmount - insuranceFee;

    // ==========================================
    // --- CASE A: Handle Limit Order Placement ---
    // ==========================================
    if (isLimit) {
      // 1. Process limit BUY orders
      if (type === 'buy') {
        // Query outstanding points currently locked in other open buy limit orders.
        const openBuys = await db.prepare(`SELECT SUM(points_locked) as locked FROM orders WHERE user_id = ? AND trade_type = 'buy' AND status = 'open'`).get(user.id) as { locked: number } | undefined;
        const lockedFunds = openBuys?.locked || 0;
        
        // Block placement if total required balance exceeds user's current points.
        if (!isGodMode && user.points - lockedFunds < (totalCostOrRevenue as number)) {
          return jsonError('Insufficient points (you have funds locked in open limit orders).', 400, 'BAD_REQUEST');
        }

        const orderId = crypto.randomUUID();
        // Insert order record into database.
        await db.prepare('INSERT INTO orders (id, user_id, product_id, trade_type, shares, price, status, points_locked) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(orderId, user.id, productId, type, shares, targetPrice, 'open', totalCostOrRevenue);

        // Instantly lock transaction value from buyer's account balance.
        await db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(totalCostOrRevenue, user.id);
        
        // Log debit points ledger txn.
        await db.prepare('INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)')
          .run(crypto.randomUUID(), user.id, -(totalCostOrRevenue as number), 'trade_buy', `Locked ${totalCostOrRevenue} pts for buy limit @ $${targetPrice}`);

      } 
      // 2. Process limit SELL orders
      else {
        // Verify user owns matching shares to sell.
        const existingShare = await db.prepare('SELECT * FROM user_shares WHERE user_id = ? AND product_id = ?').get(user.id, productId as string) as UserShare | undefined;
        if (!existingShare) return jsonError('Insufficient shares to place sell limit.', 400, 'BAD_REQUEST');
        
        // Query shares currently locked in other open sell limit orders.
        const openSells = await db.prepare(`SELECT SUM(shares) as locked_shares FROM orders WHERE user_id = ? AND product_id = ? AND trade_type = 'sell' AND status = 'open'`).get(user.id, productId as string) as { locked_shares: number } | undefined;
        const lockedShares = openSells?.locked_shares || 0;
        
        // Block placement if requested shares exceed unlocked shares.
        if (!isGodMode && (existingShare.shares - lockedShares < (shares as number))) {
          return jsonError('Insufficient shares (shares are locked in other open orders).', 400, 'BAD_REQUEST');
        }

        // Apply seller protection bond locking if total valuation exceeds $200.
        let bondAmount = 0;
        const orderValue = (shares as number) * (targetPrice as number);
        
        if (orderValue > 200) {
          // Vetted users with 100+ trades pay a reduced 2% bond rate, beginners pay 10%.
          const completedTrades = user.total_trades || 0;
          const bondRate = completedTrades >= 100 ? 0.02 : 0.10;
          bondAmount = Math.round(orderValue * bondRate);
          
          // Verify user can afford the security bond.
          if (!isGodMode && user.points < bondAmount) {
            return jsonError(`Seller bond required: ${bondAmount} pts (${(bondRate*100)}% of order value). Insufficient points.`, 400, 'BAD_REQUEST');
          }

          // Lock bond points from seller's balance.
          await db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(bondAmount, user.id);
          await db.prepare('INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)')
            .run(crypto.randomUUID(), user.id, -bondAmount, 'bond_lock', `Seller bond locked for sell order @ $${targetPrice}`);
        }

        const orderId = crypto.randomUUID();
        // Insert order record into database.
        await db.prepare('INSERT INTO orders (id, user_id, product_id, trade_type, shares, price, status, points_locked) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(orderId, user.id, productId, type, shares, targetPrice, 'open', bondAmount);

        // If a bond was locked, register tracking entries in the database metrics.
        if (bondAmount > 0) {
          await db.prepare('INSERT INTO seller_bonds (id, user_id, product_id, order_id, bond_amount, status, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(crypto.randomUUID(), user.id, productId, orderId, bondAmount, 'locked', new Date(Date.now() + 30*24*60*60*1000).toISOString());
          
          await recordTradeMetrics(0, 0);
          await db.prepare('UPDATE platform_metrics SET total_bonds_locked = total_bonds_locked + ? WHERE id = 1').run(bondAmount);
        }
      }

      // Query updated profile values to sync client dashboard.
      const updatedUser = await db.prepare('SELECT id, name, points, experiment_group, rrs_score, total_reviews, accurate_reviews, is_admin, total_trades FROM users WHERE id = ?').get(user.id) as User | undefined;
      
      // Fire pending price alerts.
      const { checkAndFireAlerts } = await import('@/lib/db');
      await checkAndFireAlerts(productId as string, currentPrice);

      return NextResponse.json({ success: true, message: `Limit ${type} order for ${shares} shares @ $${targetPrice} placed.`, user: updatedUser });
    }

    // ==========================================
    // --- CASE B: Market Order Execution Loop ---
    // ==========================================
    try {
      // Execute the matching engine inside a SQL database transaction to prevent partial state corruption.
      await db.transaction(async (txDb) => {
        let remainingShares = shares; // Track remaining fractions to fill
        let totalSpentOrReceived = 0;  // Track final ledger point offsets
        let totalFeesPaid = 0;        // Aggregate fees
        let totalInsurancePaid = 0;   // Aggregate insurance allocations

        // 1. Orderbook Matching Loop: match matching limit orders first
        while (remainingShares > 0) {
          // SQL query retrieves the best matching open limit order owned by another user.
          const orderQuery = type === 'buy' 
            ? `SELECT * FROM orders WHERE product_id = ? AND trade_type = 'sell' AND status = 'open' AND price <= ? AND user_id != ? ORDER BY price ASC LIMIT 1`
            : `SELECT * FROM orders WHERE product_id = ? AND trade_type = 'buy' AND status = 'open' AND price >= ? AND user_id != ? ORDER BY price DESC LIMIT 1`;

          const match = await txDb.prepare(orderQuery).get(productId, currentPrice, user.id) as Order | undefined;

          // If no matching limit order is found, exit matching loop to trigger AMM fallback.
          if (!match) break;
          // Security Check: Block execution if user attempts to trade with themselves.
          if (isSelfTrade(user.id, match.user_id)) break;

          // Fill amount is restricted by outstanding shares in either the match or user request.
          const fillAmount = Math.min(remainingShares, match.shares);
          const matchPrice = match.price;
          
          const matchBase = fillAmount * matchPrice;
          const iterFeeAmount = Math.round(matchBase * feeRate);
          const iterInsurance = Math.round(matchBase * insuranceRate);
          const iterTotalCostOrRevenue = type === 'buy' ? matchBase + iterFeeAmount + iterInsurance : matchBase - iterFeeAmount - iterInsurance;

          // Check if buyer has enough points to afford this iteration slice.
          const freshUser = await txDb.prepare('SELECT points FROM users WHERE id = ?').get(user.id) as { points: number } | undefined;
          if (!isGodMode && type === 'buy' && freshUser && freshUser.points < iterTotalCostOrRevenue) {
            throw new Error(`Insufficient points for matching trade.`);
          }
          // Check if seller has enough shares to execute sell.
          if (!isGodMode && type === 'sell') {
            const es = await txDb.prepare('SELECT * FROM user_shares WHERE user_id = ? AND product_id = ?').get(user.id, productId as string) as UserShare | undefined;
            if (!es || es.shares < fillAmount) throw new Error("Insufficient shares.");
          }

          // Apply balance offset to caller.
          await txDb.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(type === 'buy' ? -iterTotalCostOrRevenue : iterTotalCostOrRevenue, user.id);
          
          totalSpentOrReceived += iterTotalCostOrRevenue;
          totalFeesPaid += iterFeeAmount;
          totalInsurancePaid += iterInsurance;

          // If matching a buy order, return the buyer's locked excess points from their limit reserve.
          if (match.points_locked > 0) {
            const lockedPerShare = match.points_locked / match.shares;
            const lockedReturned = Math.round(lockedPerShare * fillAmount);
            await txDb.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(lockedReturned, match.user_id);
          }

          // Apply balance offsets and increment trade counters for matched order owners.
          const matchedPartyFee = Math.round(matchBase * 0.02);
          const matchedInsurance = Math.round(matchBase * insuranceRate);
          const matchTotalCost = type === 'buy' ? matchBase - matchedPartyFee - matchedInsurance : matchBase + matchedPartyFee + matchedInsurance;
          await txDb.prepare('UPDATE users SET points = points + ?, total_trades = total_trades + 1 WHERE id = ?').run(type === 'buy' ? matchTotalCost : -matchTotalCost, match.user_id);
          
          // Adjust fractional share ledger tracking rows for caller and counterparty.
          const existingShare = await txDb.prepare('SELECT * FROM user_shares WHERE user_id = ? AND product_id = ?').get(user.id, productId as string) as UserShare | undefined;
          if (type === 'buy') {
            if (existingShare) { 
              await txDb.prepare('UPDATE user_shares SET shares = shares + ?, avg_buy_price = ? WHERE id = ?')
                .run(fillAmount, ((existingShare.shares*existingShare.avg_buy_price)+(fillAmount*matchPrice))/(existingShare.shares+fillAmount), existingShare.id); 
            } else { 
              await txDb.prepare('INSERT INTO user_shares (id, user_id, product_id, shares, avg_buy_price) VALUES (?, ?, ?, ?, ?)')
                .run(crypto.randomUUID(), user.id, productId, fillAmount, matchPrice); 
            }
            await txDb.prepare('UPDATE user_shares SET shares = shares - ? WHERE user_id = ? AND product_id = ?').run(fillAmount, match.user_id, productId);
          } else {
            await txDb.prepare('UPDATE user_shares SET shares = shares - ? WHERE user_id = ? AND product_id = ?').run(fillAmount, user.id, productId);
            const mbShare = await txDb.prepare('SELECT * FROM user_shares WHERE user_id = ? AND product_id = ?').get(match.user_id, productId as string) as UserShare | undefined;
            if (mbShare) { 
              await txDb.prepare('UPDATE user_shares SET shares = shares + ?, avg_buy_price = ? WHERE id = ?')
                .run(fillAmount, ((mbShare.shares*mbShare.avg_buy_price)+(fillAmount*matchPrice))/(mbShare.shares+fillAmount), mbShare.id); 
            } else { 
              await txDb.prepare('INSERT INTO user_shares (id, user_id, product_id, shares, avg_buy_price) VALUES (?, ?, ?, ?, ?)')
                .run(crypto.randomUUID(), match.user_id, productId, fillAmount, matchPrice); 
            }
          }

          // Clean up empty share records.
          await txDb.prepare('DELETE FROM user_shares WHERE shares <= 0').run();

          // Update matching order statuses.
          if (match.shares === fillAmount) {
            await txDb.prepare(`UPDATE orders SET status = 'filled', shares = 0 WHERE id = ?`).run(match.id);
            await txDb.prepare(`UPDATE seller_bonds SET status = 'released' WHERE order_id = ?`).run(match.id);
          } else {
            await txDb.prepare('UPDATE orders SET shares = shares - ? WHERE id = ?').run(fillAmount, match.id);
          }

          // Log transaction price ticks.
          await txDb.prepare(`INSERT INTO price_history (id, product_id, price, shares, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`)
            .run(crypto.randomUUID(), productId, matchPrice, fillAmount);
          
          remainingShares -= fillAmount;
        }

        // 2. Constant Product AMM Fallback ($xy=k$): executes if remaining shares are unfilled.
        if (remainingShares > 0) {
          // Dynamic reserve generator: scales reserves inversely to asset price. Capped 500-10,000.
          const x_virt = Math.min(10000, Math.max(500, Math.round(100000 / currentPrice)));
          const y_virt = x_virt * currentPrice; 
          const k = x_virt * y_virt;

          let ammBase = 0;
          if (type === 'buy') {
            if (remainingShares >= x_virt) throw new Error("AMM Liquidity Exhausted.");
            // AMM Math: y_final - y_initial
            ammBase = (k / (x_virt - remainingShares)) - y_virt;
          } else {
            // AMM Math: y_initial - y_final
            ammBase = y_virt - (k / (x_virt + remainingShares));
          }

          const ammFee = Math.round(ammBase * feeRate);
          const ammInsurance = Math.round(ammBase * insuranceRate);
          const ammTotalCostOrRevenue = type === 'buy' ? Math.round(ammBase + ammFee + ammInsurance) : Math.round(ammBase - ammFee - ammInsurance);

          // Verify buyer can afford AMM fallback execution.
          const freshUserAmm = await txDb.prepare('SELECT points FROM users WHERE id = ?').get(user.id) as { points: number } | undefined;
          if (!isGodMode && type === 'buy' && freshUserAmm && freshUserAmm.points < ammTotalCostOrRevenue) throw new Error(`Insufficient points for AMM fallback.`);
          
          // Verify seller has enough shares.
          if (!isGodMode && type === 'sell') {
            const existingShare = await txDb.prepare('SELECT * FROM user_shares WHERE user_id = ? AND product_id = ?').get(user.id, productId as string) as UserShare | undefined;
            if (!existingShare || existingShare.shares < remainingShares) throw new Error('Insufficient shares.');
          }

          // Adjust balance for caller.
          await txDb.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(type === 'buy' ? -ammTotalCostOrRevenue : ammTotalCostOrRevenue, user.id);
          
          totalSpentOrReceived += ammTotalCostOrRevenue;
          totalFeesPaid += ammFee;
          totalInsurancePaid += ammInsurance;

          // Adjust shares ledger tracking.
          if (type === 'buy') {
            const existingShare = await txDb.prepare('SELECT * FROM user_shares WHERE user_id = ? AND product_id = ?').get(user.id, productId as string) as UserShare | undefined;
            if (existingShare) { 
              await txDb.prepare('UPDATE user_shares SET shares = shares + ?, avg_buy_price = ? WHERE id = ?')
                .run(remainingShares, ((existingShare.shares*existingShare.avg_buy_price)+(remainingShares*currentPrice))/(existingShare.shares+remainingShares), existingShare.id); 
            } else { 
              await txDb.prepare('INSERT INTO user_shares (id, user_id, product_id, shares, avg_buy_price) VALUES (?, ?, ?, ?, ?)')
                .run(crypto.randomUUID(), user.id, productId, remainingShares, currentPrice); 
            }
          } else {
            await txDb.prepare('UPDATE user_shares SET shares = shares - ? WHERE user_id = ? AND product_id = ?').run(remainingShares, user.id, productId);
            await txDb.prepare('DELETE FROM user_shares WHERE shares <= 0').run();
          }

          // Log transaction price ticks.
          await txDb.prepare(`INSERT INTO price_history (id, product_id, price, shares, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`)
            .run(crypto.randomUUID(), productId, currentPrice, remainingShares);
        }
        
        // Record final point transactions ledger.
        await txDb.prepare('INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)')
          .run(crypto.randomUUID(), user.id, type === 'buy' ? -totalSpentOrReceived : totalSpentOrReceived, 
            type === 'buy' ? 'trade_buy' : 'trade_sell', 
            `${type === 'buy' ? 'Bought' : 'Sold'} ${shares} shares @ $${currentPrice}`);
        
        // Log trade record.
        await txDb.prepare('INSERT INTO trades (id, user_id, product_id, trade_type, shares, price_per_share, total_cost, fee_paid, insurance_fee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(crypto.randomUUID(), user.id, productId, type, shares, currentPrice, totalSpentOrReceived, totalFeesPaid, totalInsurancePaid);

        // Dispatch notifications.
        await createNotification(user.id, 'Trade Executed', `Successfully ${type === 'buy' ? 'bought' : 'sold'} ${shares} shares of ${product.name} @ $${currentPrice}.`, 'trade');

        // Increment trade count stats.
        await txDb.prepare('UPDATE users SET total_trades = total_trades + 1 WHERE id = ?').run(user.id);
        
        // 3. Economic Fee Split: distribute 70% of transaction fees to Node authenticators who certified the asset.
        if (totalFeesPaid > 0) {
          // Query verified authenticators for this product.
          const productAuthenticators = await txDb.prepare(`
            SELECT user_id FROM authentications 
            WHERE product_id = ? AND verdict = 'authentic'
          `).all(productId) as { user_id: string }[];

          if (productAuthenticators.length > 0) {
            const authRewardTotal = Math.round(totalFeesPaid * 0.70);
            const rewardPerAuth = Math.floor(authRewardTotal / productAuthenticators.length);
            
            // Distribute points and notify node owners.
            for (const auth of productAuthenticators) {
              await txDb.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(rewardPerAuth, auth.user_id);
              await txDb.prepare('INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)')
                .run(crypto.randomUUID(), auth.user_id, rewardPerAuth, 'authenticator_commission', `Earned 70% fee-split commission for securing ${product.name}`);
              
              await createNotification(auth.user_id, 'Yield Distribution', `You earned ${rewardPerAuth} PTS commission from protocol trading activity for ${product.name}.`, 'yield');
            }
            console.log(`[ECONOMICS] Distributed ${authRewardTotal} pts commission to ${productAuthenticators.length} authenticators.`);
          }
        }
        
        // Update platform metrics.
        await recordTradeMetrics(totalFeesPaid, totalInsurancePaid);
      });
      
      // 4. Run Z-score price anomaly detector.
      const { detectPriceAnomaly } = await import('@/lib/anomaly-detector');
      await detectPriceAnomaly(productId as string, currentPrice, user.id as string);
      
    } catch (err: unknown) {
      const tradeErrMsg = err instanceof Error ? err.message : String(err);
      console.error('[TRADE] Market order execution failed:', tradeErrMsg);
      return jsonError(tradeErrMsg || 'Trade execution failed. Please try again.', 400, 'BAD_REQUEST');
    }

    // Retrieve updated profile balance records.
    const updatedUser = await db.prepare('SELECT id, name, points, experiment_group, rrs_score, total_reviews, accurate_reviews, is_admin, total_trades FROM users WHERE id = ?').get(user.id) as User | undefined;

    // Log append-only audit trail record.
    await writeAuditLog('trade_executed', user.id as string, {
      targetId: productId as string,
      targetType: 'product',
      details: { type, shares, price: currentPrice, isLimit: false },
    });
    
    // Fire price alerts.
    const { checkAndFireAlerts } = await import('@/lib/db');
    await checkAndFireAlerts(productId as string, currentPrice);

    // Send trade confirmation email (async, non-blocking)
    import('@/lib/email').then(({ sendTradeConfirmation }) => {
      const tradeId = crypto.randomUUID();
      sendTradeConfirmation({
        email:        String(user.email),
        name:         String(user.name),
        tradeType:    type as 'buy' | 'sell',
        shares:       safeShares,
        productName:  String(product.name),
        brand:        String(product.brand),
        pricePerShare: currentPrice,
        totalCost:    baseAmount,
        feePaid:      feeAmount,
        tradeId,
      }).catch(e => console.error('[TRADE_EMAIL]', e));
    }).catch(() => {});

    return NextResponse.json({ success: true, message: `Successfully ${type === 'buy' ? 'bought' : 'sold'} ${shares} shares.`, user: updatedUser });

  } catch (error) {
    console.error('Trade Error:', error);
    return jsonError('Internal Server Error', 500, 'INTERNAL');
  }
}
