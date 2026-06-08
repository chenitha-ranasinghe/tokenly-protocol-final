/**
 * PRODUCTION SEEDING SCRIPT v1.0
 * Run this to populate your live environment with institutional-grade assets.
 */
const { getDb } = require('../src/lib/db');
const crypto = require('crypto');

async function seed() {
  console.log('--- STARTING INSTITUTIONAL SEEDING ---');
  const db = await getDb();

  const luxuryAssets = [
    {
      id: 'luxury-rolex-001',
      name: 'Cosmograph Daytona "Panda"',
      brand: 'Rolex',
      sku: '116500LN-0001',
      category: 'Watches',
      retail: 14800,
      market_low: 32000,
      market_high: 36000,
      consensus: 34500,
      vault: 'Malca-Amit Singapore',
      insurance: 'Lloyd\'s of London Pol #LX-9921'
    },
    {
      id: 'luxury-patek-001',
      name: 'Nautilus Blue Dial',
      brand: 'Patek Philippe',
      sku: '5711/1A-010',
      category: 'Watches',
      retail: 33710,
      market_low: 110000,
      market_high: 145000,
      consensus: 125000,
      vault: 'Brink\'s Geneva',
      insurance: 'AIG Private Client Pol #PP-0021'
    },
    {
      id: 'luxury-bag-001',
      name: 'Birkin 30 Black Togo Gold',
      brand: 'Hermès',
      sku: 'H-B30-TOGO-BK',
      category: 'Handbags',
      retail: 11600,
      market_low: 24000,
      market_high: 28000,
      consensus: 26000,
      vault: 'Malca-Amit London',
      insurance: 'Chubb Luxury Asset Pol #HB-881'
    },
    {
      id: 'luxury-sneaker-001',
      name: 'Air Jordan 1 Retro High "Dior"',
      brand: 'Jordan',
      sku: 'CN8607-002',
      category: 'Sneakers',
      retail: 2000,
      market_low: 7500,
      market_high: 9500,
      consensus: 8200,
      vault: 'StockX Verified Vault NJ',
      insurance: 'InsureX Blockchain Policy #AJ-11'
    }
  ];

  for (const asset of luxuryAssets) {
    try {
      await db.prepare(`
        INSERT INTO products (
          id, name, brand, sku, category, retail_price, 
          market_price_low, market_price_high, consensus_price, 
          initial_consensus, total_tokens, verification_status,
          vault_location, insurance_policy, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1000, 'certified', ?, ?, datetime('now'))
      `).run(
        asset.id, asset.name, asset.brand, asset.sku, asset.category, 
        asset.retail, asset.market_low, asset.market_high, asset.consensus,
        asset.consensus, asset.vault, asset.insurance
      );
      console.log(`[SEED] Inserted: ${asset.name}`);
    } catch (e) {
      console.warn(`[SEED_SKIP] ${asset.name} already exists or error:`, e.message);
    }
  }

  console.log('--- SEEDING COMPLETE ---');
  process.exit(0);
}

seed().catch(console.error);
