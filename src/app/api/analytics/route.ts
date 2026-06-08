import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 });
    const db = await getDb();

    const overall = await db.prepare(`SELECT COUNT(DISTINCT u.id) as total_users, COUNT(DISTINCT r.id) as total_reviews, COALESCE(SUM(r.points_staked),0) as total_points_staked, COUNT(DISTINCT r.product_id) as products_reviewed FROM users u LEFT JOIN reviews r ON u.id = r.user_id`).get() as Record<string,number>;

    const abComparison = await db.prepare(`
      SELECT u.experiment_group, COUNT(DISTINCT u.id) as users, COALESCE(SUM(u.review_count),0) as reviews,
        AVG(u.avg_acc) as avg_accuracy, AVG(u.avg_stake) as avg_stake,
        CASE WHEN SUM(u.review_count)>0 THEN SUM(u.accurate_count)*100.0/SUM(u.review_count) ELSE 0 END as accuracy_rate,
        AVG(u.rrs_score) as avg_rrs
      FROM (SELECT us.id, us.experiment_group, us.rrs_score, us.total_reviews as review_count, us.accurate_reviews as accurate_count,
        (SELECT AVG(r2.accuracy_score) FROM reviews r2 WHERE r2.user_id=us.id) as avg_acc,
        (SELECT AVG(r3.points_staked) FROM reviews r3 WHERE r3.user_id=us.id) as avg_stake
        FROM users us WHERE us.total_reviews>0) u GROUP BY u.experiment_group
    `).all() as Record<string,unknown>[];

    const consensusShift = await db.prepare(`SELECT p.id,p.name,p.brand,p.initial_consensus,p.consensus_price,p.total_reviews,ROUND(CAST(ABS(p.consensus_price-p.initial_consensus)*100.0/NULLIF(p.initial_consensus,0) AS NUMERIC),1) as shift_pct FROM products p WHERE p.total_reviews>0 ORDER BY p.total_reviews DESC LIMIT 20`).all();
    const stakingDistribution = await db.prepare(`SELECT CASE WHEN points_staked=0 THEN '0 (None)' WHEN points_staked<=50 THEN '1-50' WHEN points_staked<=100 THEN '51-100' WHEN points_staked<=200 THEN '101-200' WHEN points_staked<=500 THEN '201-500' ELSE '500+' END as stake_range, COUNT(*) as count, SUM(CASE WHEN is_accurate=1 THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(*),0) as accuracy_rate FROM reviews GROUP BY stake_range ORDER BY MIN(points_staked)`).all();
    const accuracyByPrice = await db.prepare(`SELECT CASE WHEN p.initial_consensus<150 THEN 'Under $150' WHEN p.initial_consensus<300 THEN '$150-299' WHEN p.initial_consensus<500 THEN '$300-499' WHEN p.initial_consensus<1000 THEN '$500-999' ELSE '$1000+' END as price_tier, COUNT(r.id) as reviews, SUM(CASE WHEN r.is_accurate=1 THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(r.id),0) as accuracy_rate FROM reviews r JOIN products p ON r.product_id=p.id GROUP BY price_tier`).all();
    const tierDistribution = await db.prepare(`SELECT CASE WHEN rrs_score>=80 THEN 'Verified Elite' WHEN rrs_score>=60 THEN 'Expert' WHEN rrs_score>=40 THEN 'Trusted' WHEN rrs_score>=20 THEN 'Reviewer' ELSE 'Standard' END as tier, COUNT(*) as count FROM users WHERE total_reviews>0 GROUP BY tier`).all();

    const s = abComparison.find(g=>g.experiment_group==='staking');
    const c = abComparison.find(g=>g.experiment_group==='control');
    let experimentInsight = 'Not enough data for A/B comparison yet.';
    if (s && c && (Number(s.reviews) >= 5) && (Number(c.reviews) >= 5)) {
      const sAcc = Number(s.accuracy_rate || 0);
      const cAcc = Number(c.accuracy_rate || 0);
      const diff = sAcc - cAcc;
      if (Math.abs(diff) < 3) experimentInsight = `Both groups similar (~${sAcc.toFixed(1)}% vs ${cAcc.toFixed(1)}%). More data needed.`;
      else if (diff > 0) experimentInsight = `Staking ${diff.toFixed(1)}pp more accurate (${sAcc.toFixed(1)}% vs ${cAcc.toFixed(1)}%). Hypothesis SUPPORTED.`;
      else experimentInsight = `Control ${Math.abs(diff).toFixed(1)}pp more accurate. Hypothesis CHALLENGED.`;
    }
    return NextResponse.json({ overall, abComparison, consensusShift, stakingDistribution, accuracyByPrice, tierDistribution, experimentInsight });
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
