/**
 * Seed realistic demo rows — no fake wisdom prices; uses retail + market bands only.
 * SQLite-oriented; for Postgres extend with ON CONFLICT syntax as needed.
 */
import { randomUUID } from 'crypto';
import { getDb } from '../src/lib/db';

async function main(): Promise<void> {
  if (process.env.DATABASE_URL) {
    console.log('[seed] Postgres DATABASE_URL set — use admin UI or extend this script for ON CONFLICT inserts.');
    return;
  }
  const db = await getDb();
  const pid = `demo_product_${randomUUID().slice(0, 8)}`;
  await db
    .prepare(
      `INSERT OR IGNORE INTO products (id, name, brand, sku, retail_price, market_price_low, market_price_high, consensus_price, category, price_confidence)
       VALUES (?, 'Demo Vault Sneaker', 'Tokenly Labs', ?, 420, 400, 450, 425, 'Sneakers', 35)`
    )
    .run(pid, `SKU-${pid.slice(-6)}`);
  const uid = randomUUID();
  await db
    .prepare(
      `INSERT OR IGNORE INTO users (id, email, name, points, experiment_group) VALUES (?, ?, 'Seed User', 10000, 'staking')`
    )
    .run(uid, `seed_${uid.slice(0, 6)}@example.test`);
  console.log('[seed] Created demo product', pid, 'and user', uid);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
