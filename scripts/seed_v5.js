const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const Database = require('better-sqlite3');
const dotenv = require('dotenv');
const crypto = require('crypto');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('+ Loaded .env.local');
}

const DATABASE_URL = process.env.DATABASE_URL;
const IS_POSTGRES = !!DATABASE_URL;

async function seedV5() {
  console.log(`--- Tokenly V5 Seeder [Mode: ${IS_POSTGRES ? 'PostgreSQL' : 'SQLite'}] ---`);

  let db;
  if (IS_POSTGRES) {
    const pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false
    });
    db = {
      prepare: (sql) => ({
        get: async (...args) => {
          let i = 0;
          const pgSql = sql.replace(/\?/g, () => `$${++i}`);
          const res = await pool.query(pgSql, args);
          return res.rows[0];
        },
        all: async (...args) => {
          let i = 0;
          const pgSql = sql.replace(/\?/g, () => `$${++i}`);
          const res = await pool.query(pgSql, args);
          return res.rows;
        },
        run: async (...args) => {
          let i = 0;
          const pgSql = sql.replace(/\?/g, () => `$${++i}`);
          await pool.query(pgSql, args);
        }
      })
    };
  } else {
    const dbPath = path.join(__dirname, '..', 'tokenly.db');
    const sqlite = new Database(dbPath);
    db = {
      prepare: (sql) => ({
        get: async (...args) => sqlite.prepare(sql).get(...args),
        all: async (...args) => sqlite.prepare(sql).all(...args),
        run: async (...args) => sqlite.prepare(sql).run(...args)
      })
    };
  }

  try {
    const adminEmail = 'admin@tokenly.luxury';
    const admin = await db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
    if (!admin) {
        console.error('Admin user not found. Run connection script first.');
        process.exit(1);
    }

    const products = [
      { id: 'p_standard_1', name: 'Jordan 1 Retro High "Lost & Found"', brand: 'Jordan', sku: 'DZ5485-612', price: 450, category: 'Sneakers' },
      { id: 'p_luxury_1', name: 'Richard Mille RM 11-03 McLaren', brand: 'Richard Mille', sku: 'RM11-03-MCL', price: 350000, category: 'Watches' },
      { id: 'p_rwa_mbs_001', name: 'Marina Bay Sands Penthouse Portfolio', brand: 'Tokenly RWA', sku: 'DEED-MBS-001', price: 2500000, category: 'Real Estate' },
      { id: '24131a35-108d-42d1-81fc-81eda6ec3f91', name: 'Rolex Daytona "Paul Newman" 6239', brand: 'Rolex', sku: 'RLX-PN-6239', price: 285000, category: 'Watches' },
      { id: 'p_patek_1', name: 'Patek Philippe Nautilus 5711/1A', brand: 'Patek Philippe', sku: 'PP-5711-1A', price: 125000, category: 'Watches' }
    ];

    console.log('+ Seeding Products...');
    for (const p of products) {
      await db.prepare(`
        INSERT INTO products (id, name, brand, sku, category, retail_price, market_price_low, market_price_high, consensus_price, initial_consensus, verification_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET 
          name = EXCLUDED.name,
          verification_status = EXCLUDED.verification_status
      `).run(p.id, p.name, p.brand, p.sku, p.category, p.price, p.price * 0.95, p.price * 1.1, p.price, p.price, 'certified');
    }

    console.log('+ Seeding Admin Reviews (for Leaderboard/Dashboard visibility)...');
    // Clear old reviews to avoid unique constraint issues
    await db.prepare('DELETE FROM reviews WHERE user_id = ?').run(admin.id);
    
    for (const p of products) {
        await db.prepare(`
            INSERT INTO reviews (id, user_id, product_id, price_estimate, condition_grade, review_text, is_accurate, accuracy_score, reward_amount)
            VALUES (?, ?, ?, ?, ?, ?, 1, 99.5, 50)
        `).run(crypto.randomUUID(), admin.id, p.id, p.price, 10, 'Institutional protocol seed for V5 launch.');
    }

    console.log('+ Updating Admin Stats...');
    await db.prepare(`
        UPDATE users SET total_reviews = 3, accurate_reviews = 3, rrs_score = 99.9, points = 10000000 WHERE id = ?
    `).run(admin.id);

    console.log('--- Seeding Complete: V5 Protocol is Populated ---');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seedV5();
