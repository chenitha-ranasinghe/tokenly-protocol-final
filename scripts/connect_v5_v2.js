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

async function connectAll() {
  console.log(`--- Tokenly V5 Connection [Mode: ${IS_POSTGRES ? 'PostgreSQL' : 'SQLite'}] ---`);

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
        run: async (...args) => sqlite.prepare(sql).run(...args)
      })
    };
  }

  try {
    // 1. Ensure Admin User
    const adminEmail = 'admin@tokenly.luxury';
    const admin = await db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);
    
    if (!admin) {
      console.log('+ Creating Admin User...');
      const adminId = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO users (id, email, name, points, is_admin, rrs_score, experiment_group)
        VALUES (?, ?, ?, 10000000, 1, 99.9, 'staking')
      `).run(adminId, adminEmail, 'Protocol Administrator');
    } else {
      console.log('+ Hardening Admin Permissions...');
      await db.prepare(`
        UPDATE users SET is_admin = 1, points = 10000000, rrs_score = 99.9 WHERE email = ?
      `).run(adminEmail);
    }

    // 2. Initialize Platform Metrics if missing
    await db.prepare(`INSERT INTO platform_metrics (id) VALUES (1) ON CONFLICT(id) DO NOTHING`).run();
    
    console.log('--- Connection Complete: V5 Core is Linked ---');
    process.exit(0);
  } catch (err) {
    console.error('Connection failed:', err);
    process.exit(1);
  }
}

connectAll();
