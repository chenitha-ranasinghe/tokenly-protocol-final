// Import database execution types, adapters, and clients for TypeScript verification.
import type { SQLParams, MigrationDb, DbAdapter, TransactionClient } from './db-types';

// Import the better-sqlite3 database engine driver.
import Database from 'better-sqlite3';

// Import the path module to resolve file directories on local systems.
import path from 'path';

// Import the crypto module to generate random UUIDs and secure session tokens.
import crypto from 'crypto';

// Import the filesystem module to check directory existence.
import fs from 'fs';

// Configuration: The persistent directory path for production deployments (e.g. Docker/Railway).
const PERSISTENT_DIR = '/data';

// Configuration: The default database file path when running locally in development.
const LOCAL_DB = path.join(process.cwd(), 'tokenly.db');

// Configuration: The persistent database file path when running in production.
const PRODUCTION_DB = path.join(PERSISTENT_DIR, 'tokenly.db');

// Database Selection: If the production /data folder exists, use it; otherwise, use the local path.
export const DB_PATH = fs.existsSync(PERSISTENT_DIR) ? PRODUCTION_DB : LOCAL_DB;

// Internal Variable: Holds the singleton instance of the opened SQLite database connection.
let sqliteDb: Database.Database | null = null;

/**
 * Initializes and retrieves the opened SQLite database instance with WAL and foreign key support.
 * Uses a singleton pattern: if already opened, it returns the existing instance immediately.
 * 
 * @returns An adapter containing transaction blocks and query preparers.
 */
export async function getDb(): Promise<DbAdapter> {
  // 1. If the database instance has not been created, initialize it.
  if (!sqliteDb) {
    // Open or create the SQLite database file.
    sqliteDb = new Database(DB_PATH);
    
    // Enable Write-Ahead Logging (WAL) to allow concurrent reads during active writes.
    sqliteDb.pragma('journal_mode = WAL');
    
    // Enforce foreign key constraints to prevent orphan data records.
    sqliteDb.pragma('foreign_keys = ON');
    
    // Create the base schema tables synchronously before accepting requests.
    initializeSchemaSync(sqliteDb);
    
    // Wrap database for migration queries.
    const dbWrap = { exec: async (sql: string) => sqliteDb!.exec(sql) };
    
    // Run schema migrations asynchronously to integrate updates like notification tables.
    runMigrations(dbWrap).catch(err => console.error('SQLite Migration failed', err));
  }
  
  // 2. Return the wrapped Database Adapter helper object.
  const db = sqliteDb;
  return {
    // Direct SQL code execution function.
    exec: async (sql: string) => db.exec(sql),
    
    // SQL Statement preparer: returns execute methods mapped to SQLite queries.
    prepare: (sql: string) => ({
      // Fetch a single row matching parameters.
      get: async (...args: SQLParams) => db.prepare(sql).get(...args),
      // Fetch all matching rows as an array.
      all: async (...args: SQLParams) => db.prepare(sql).all(...args),
      // Execute INSERT/UPDATE/DELETE writes.
      run: async (...args: SQLParams) => db.prepare(sql).run(...args),
    }),
    
    // Transaction Wrapper: ensures multiple database queries execute atomically.
    transaction: async (fn: (txDb: TransactionClient) => Promise<void>) => {
      // Begin transaction block: lock table state.
      db.prepare('BEGIN').run();
      try {
        const txDb = {
          prepare: (sql: string) => ({
            get: async (...args: SQLParams) => db.prepare(sql).get(...args),
            all: async (...args: SQLParams) => db.prepare(sql).all(...args),
            run: async (...args: SQLParams) => db.prepare(sql).run(...args),
          }),
          exec: async (sql: string) => db.exec(sql),
        };
        // Execute the user-provided transaction query function.
        await fn(txDb);
        // Commit changes: apply updates permanently to the database file.
        db.prepare('COMMIT').run();
      } catch (e) {
        // Rollback: discard all queries written inside this transaction block on error.
        db.prepare('ROLLBACK').run();
        throw e;
      }
    },
  };
}

/**
 * Updates platform metrics tracking totals after a successful trade execution.
 * 
 * @param feeAmount - Total trading fees collected.
 * @param insuranceFee - Total insurance pool contributions collected.
 */
export async function recordTradeMetrics(feeAmount: number, insuranceFee: number) {
  // 1. Establish database connection.
  const db = await getDb();
  
  // 2. Calculate point burn amount: 0.3% of the collected transaction fees are burned.
  const burnAmount = Math.round(feeAmount * 0.003 * 100) / 100;
  
  // 3. SQL string fragment to capture current time.
  const ts = "datetime('now')";
  
  // 4. Update the global stats tracking row (ID = 1).
  await db.prepare(`UPDATE platform_metrics SET 
    total_fees_collected = total_fees_collected + ?,
    total_insurance_pool = total_insurance_pool + ?,
    total_burned = total_burned + ?,
    updated_at = ${ts}
    WHERE id = 1`).run(feeAmount, insuranceFee, burnAmount);
}

/**
 * Synchronously defines and builds the core database schema and tables.
 * 
 * @param db - Raw better-sqlite3 database connection object.
 */
function initializeSchemaSync(db: Database.Database) {
  // SQL string fragment to resolve current timestamp during inserts.
  const ts = "datetime('now')";
  
  // Execute SQL table creation queries.
  db.exec(`
    -- 1. Users Table: tracks profiles, points, Privy IDs, and RRS scores.
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT, session_token TEXT,
      wallet_address TEXT UNIQUE, private_key TEXT UNIQUE,
      points INTEGER DEFAULT 10000, experiment_group TEXT DEFAULT 'staking',
      created_at TEXT DEFAULT (${ts}), last_active_at TEXT DEFAULT (${ts}),
      total_reviews INTEGER DEFAULT 0, accurate_reviews INTEGER DEFAULT 0, 
      rrs_score REAL DEFAULT 50.0, is_banned INTEGER DEFAULT 0, is_admin INTEGER DEFAULT 0, 
      total_trades INTEGER DEFAULT 0, privy_did TEXT UNIQUE,
      is_id_verified INTEGER DEFAULT 0
    );

    -- 2. Products Table: tracks physical vaulted items and their consensus values.
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, name TEXT, brand TEXT, sku TEXT UNIQUE, category TEXT DEFAULT 'Sneakers',
      retail_price REAL, market_price_low REAL, market_price_high REAL, consensus_price REAL, initial_consensus REAL,
      total_tokens INTEGER DEFAULT 1000, total_reviews INTEGER DEFAULT 0, price_confidence INTEGER DEFAULT 30,
      verification_status TEXT DEFAULT 'certified',
      created_at TEXT DEFAULT (${ts})
    );

    -- 3. Reviews Table: tracks estimations and stakes submitted by reviewers.
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY, user_id TEXT, product_id TEXT, condition_grade INTEGER, price_estimate REAL,
      review_text TEXT, points_staked INTEGER DEFAULT 0, is_accurate INTEGER DEFAULT NULL,
      accuracy_score REAL DEFAULT NULL, reward_amount INTEGER DEFAULT 0, created_at TEXT DEFAULT (${ts}),
      UNIQUE(user_id, product_id)
    );

    -- 4. User Shares Table: tracks fractions owned by users for each asset.
    CREATE TABLE IF NOT EXISTS user_shares (
      id TEXT PRIMARY KEY, user_id TEXT, product_id TEXT, shares INTEGER DEFAULT 0, avg_buy_price REAL DEFAULT 0,
      UNIQUE(user_id, product_id)
    );

    -- 5. Trades Table: logs completed market and orderbook executions.
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY, user_id TEXT, product_id TEXT, trade_type TEXT, shares INTEGER, price_per_share REAL,
      total_cost REAL, fee_paid REAL, insurance_fee REAL DEFAULT 0, created_at TEXT DEFAULT (${ts})
    );

    -- 6. Point Transactions Table: ledger logs of point credit/debits.
    CREATE TABLE IF NOT EXISTS point_transactions (
      id TEXT PRIMARY KEY, user_id TEXT, amount INTEGER, type TEXT, review_id TEXT, description TEXT, created_at TEXT DEFAULT (${ts})
    );

    -- 7. Platform Metrics Table: holds protocol-wide financials and halts.
    CREATE TABLE IF NOT EXISTS platform_metrics (
      id INTEGER PRIMARY KEY CHECK(id = 1), total_fees_collected REAL DEFAULT 0, 
      total_insurance_pool REAL DEFAULT 0, total_burned REAL DEFAULT 0, total_bonds_locked REAL DEFAULT 0,
      trading_halted INTEGER DEFAULT 0, updated_at TEXT DEFAULT (${ts})
    );

    -- 8. Rate Limits Table: logs client access counts for API security.
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY, count INTEGER DEFAULT 1, window_start TEXT DEFAULT (${ts})
    );

    -- 9. Experiment Events Table: logs data for A/B testing user engagement.
    CREATE TABLE IF NOT EXISTS experiment_events (
      id TEXT PRIMARY KEY, user_id TEXT, event_type TEXT, event_data TEXT, created_at TEXT DEFAULT (${ts})
    );

    -- 10. Price History Table: records historical trade ticks for momentum charts.
    CREATE TABLE IF NOT EXISTS price_history (
      id TEXT PRIMARY KEY, product_id TEXT, price REAL, shares INTEGER, created_at TEXT DEFAULT (${ts})
    );

    -- 11. Orders Table: represents open limit orders inside the orderbook.
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, user_id TEXT, product_id TEXT, trade_type TEXT, shares INTEGER, price REAL,
      status TEXT DEFAULT 'open', points_locked REAL DEFAULT 0, created_at TEXT DEFAULT (${ts})
    );

    -- 12. Seller Bonds Table: records security collateral locked for valuable sales.
    CREATE TABLE IF NOT EXISTS seller_bonds (
      id TEXT PRIMARY KEY, user_id TEXT, product_id TEXT, order_id TEXT, bond_amount REAL, status TEXT DEFAULT 'locked',
      created_at TEXT DEFAULT (${ts}), expires_at TEXT
    );

    -- 13. Redemptions Table: logs shipping claims for physical asset delivery.
    CREATE TABLE IF NOT EXISTS redemptions (
      id TEXT PRIMARY KEY, user_id TEXT, product_id TEXT, status TEXT DEFAULT 'pending', 
      shipping_address TEXT, contact_number TEXT, redemption_method TEXT,
      created_at TEXT DEFAULT (${ts})
    );

    -- 14. Quest Completions Table: logs user completion of dashboard tutorial tasks.
    CREATE TABLE IF NOT EXISTS quest_completions (
      id TEXT PRIMARY KEY, user_id TEXT, quest_id TEXT, completed_at TEXT DEFAULT (${ts}),
      UNIQUE(user_id, quest_id)
    );

    -- 15. Authentications Table: holds AI and manual certification verdict logs.
    CREATE TABLE IF NOT EXISTS authentications (
      id TEXT PRIMARY KEY, user_id TEXT, product_id TEXT, verdict TEXT, notes TEXT, 
      verification_hash TEXT, cert_id TEXT, grade INTEGER,
      confidence_score REAL DEFAULT 0, status INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (${ts}), UNIQUE(user_id, product_id)
    );

    -- 16. Alerts Table: tracks user-defined target price alert triggers.
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      product_id TEXT NOT NULL REFERENCES products(id), target_price REAL NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('above', 'below')),
      status TEXT NOT NULL DEFAULT 'active', created_at TEXT DEFAULT (${ts})
    );

    -- Optimize searches with custom index keys to avoid full table scans.
    CREATE INDEX IF NOT EXISTS idx_reviews_sqlite ON reviews(user_id, product_id);
    CREATE INDEX IF NOT EXISTS idx_trades_sqlite ON trades(user_id, product_id);
    CREATE INDEX IF NOT EXISTS idx_orders_sqlite ON orders(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at);
    CREATE INDEX IF NOT EXISTS idx_trades_product ON trades(product_id);
    CREATE INDEX IF NOT EXISTS idx_price_hist_product_time ON price_history(product_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_user_shares_lookup ON user_shares(user_id, product_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_product_status ON alerts(product_id, status);

    -- 17. Audit Log Table: MAS-compliant tamper-proof change ledger.
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY, timestamp TEXT DEFAULT (${ts}), action TEXT, actor_id TEXT, target_id TEXT,
      target_type TEXT, details TEXT DEFAULT '{}', ip_address TEXT, integrity_hash TEXT
    );

    -- Seed the global metrics row (ID=1) if it doesn't already exist.
    INSERT OR IGNORE INTO platform_metrics (id) VALUES (1);
  `);
}

/**
 * Runs incremental migrations to update table structures without wiping data.
 * 
 * @param db - Wrapped migration database execution object.
 */
async function runMigrations(db: MigrationDb) {
  const ts = "datetime('now')";
  const type = "DATETIME";

  // Migration 4: Integrate Notifications Table
  try {
    await db.exec?.(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'info',
        is_read INT DEFAULT 0,
        created_at ${type} DEFAULT (${ts})
      );
      CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(is_read);
    `);
    console.log('[MIGRATION] notifications table integrated.');
  } catch (e: unknown) { 
    console.warn('[MIGRATION_WARN] notifications:', e instanceof Error ? e.message : String(e)); 
  }

  // Migration 5: Integrate Governance DAO Tables
  try {
    await db.exec?.(`
      CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        creator_id TEXT NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        votes_for REAL DEFAULT 0,
        votes_against REAL DEFAULT 0,
        expires_at ${type},
        created_at ${type} DEFAULT (${ts})
      );
      CREATE TABLE IF NOT EXISTS proposal_votes (
        id TEXT PRIMARY KEY,
        proposal_id TEXT NOT NULL REFERENCES proposals(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        vote_type TEXT NOT NULL,
        weight REAL NOT NULL,
        voted_at ${type} DEFAULT (${ts}),
        UNIQUE(proposal_id, user_id)
      );
    `);
    console.log('[MIGRATION] Governance DAO tables integrated.');
  } catch (e: unknown) { 
    console.warn('[MIGRATION_WARN] governance:', e instanceof Error ? e.message : String(e)); 
  }

  // Migration 6: Add Logistics Vault details to products
  try {
    await db.exec?.("ALTER TABLE products ADD COLUMN vault_location TEXT");
    await db.exec?.("ALTER TABLE products ADD COLUMN insurance_policy TEXT");
    await db.exec?.("ALTER TABLE products ADD COLUMN digital_deed_hash TEXT");
    await db.exec?.("ALTER TABLE products ADD COLUMN image_url TEXT");
    console.log('[MIGRATION] Logistics metadata added to products.');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // Ignore errors caused by columns already existing from previous runs.
    if (msg && !msg.includes('already exists') && !msg.includes('duplicate column')) {
      console.warn('[MIGRATION_WARN] logistics migration:', msg);
    }
  }

  // Migration 7: Add identity verification columns to users
  try {
    await db.exec?.("ALTER TABLE users ADD COLUMN is_id_verified INT DEFAULT 0");
    console.log('[MIGRATION] Identity verification status added to users.');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg && !msg.includes('already exists') && !msg.includes('duplicate column')) {
      console.warn('[MIGRATION_WARN] identity migration:', msg);
    }
  }

  // Migration 8: Phase 3 construction marketplace + Phase 4 second-hand + legal gate
  try {
    await db.exec?.(`
      CREATE TABLE IF NOT EXISTS construction_companies (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        company_name TEXT NOT NULL,
        district TEXT NOT NULL,
        specializations TEXT DEFAULT '[]',
        crs_score REAL DEFAULT 50,
        on_time_rate REAL DEFAULT 0,
        cost_accuracy REAL DEFAULT 0,
        milestone_adherence REAL DEFAULT 0,
        bond_return_rate REAL DEFAULT 100,
        total_projects INTEGER DEFAULT 0,
        created_at ${type} DEFAULT (${ts})
      );
      CREATE INDEX IF NOT EXISTS idx_construction_co_user ON construction_companies(user_id);

      CREATE TABLE IF NOT EXISTS construction_projects (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        land_deed_ref TEXT,
        district TEXT NOT NULL,
        brief TEXT,
        status TEXT DEFAULT 'draft',
        legal_status TEXT DEFAULT 'none',
        approval_doc_hash TEXT,
        floor_plan_json TEXT,
        compliance_report_json TEXT,
        estimated_land_value REAL,
        estimated_finished_value REAL,
        estimated_build_cost REAL,
        token_minted INTEGER DEFAULT 0,
        winning_bid_id TEXT,
        created_at ${type} DEFAULT (${ts}),
        updated_at ${type} DEFAULT (${ts})
      );
      CREATE INDEX IF NOT EXISTS idx_construction_proj_owner ON construction_projects(owner_id);
      CREATE INDEX IF NOT EXISTS idx_construction_proj_status ON construction_projects(status);

      CREATE TABLE IF NOT EXISTS construction_bids (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES construction_projects(id),
        company_id TEXT NOT NULL REFERENCES construction_companies(id),
        fixed_price_lkr REAL NOT NULL,
        earliest_weeks INTEGER NOT NULL,
        likely_weeks INTEGER NOT NULL,
        latest_weeks INTEGER NOT NULL,
        confidence REAL DEFAULT 70,
        milestone_schedule_json TEXT,
        bond_amount_lkr REAL DEFAULT 0,
        status TEXT DEFAULT 'submitted',
        created_at ${type} DEFAULT (${ts}),
        UNIQUE(project_id, company_id)
      );
      CREATE INDEX IF NOT EXISTS idx_construction_bid_project ON construction_bids(project_id);

      CREATE TABLE IF NOT EXISTS construction_milestones (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES construction_projects(id),
        bid_id TEXT REFERENCES construction_bids(id),
        name TEXT NOT NULL,
        pct_value REAL NOT NULL DEFAULT 20,
        sort_order INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK(status IN ('pending','submitted','verified','rejected')),
        submitted_at TEXT DEFAULT NULL,
        submitted_by TEXT DEFAULT NULL REFERENCES users(id),
        verified_at TEXT DEFAULT NULL,
        verified_by TEXT DEFAULT NULL REFERENCES users(id),
        evidence_json TEXT DEFAULT NULL,
        rejection_reason TEXT DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_construction_ms_project ON construction_milestones(project_id);

      CREATE TABLE IF NOT EXISTS second_hand_listings (
        id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        condition_grade TEXT,
        condition_score REAL,
        usability_pct REAL,
        days_owned INTEGER DEFAULT 0,
        usage_frequency TEXT DEFAULT 'occasional',
        base_price_lkr REAL NOT NULL,
        item_district TEXT NOT NULL,
        photos_json TEXT DEFAULT '[]',
        condition_report_json TEXT,
        status TEXT DEFAULT 'active',
        created_at ${type} DEFAULT (${ts})
      );
      CREATE INDEX IF NOT EXISTS idx_resale_seller ON second_hand_listings(seller_id);
      CREATE INDEX IF NOT EXISTS idx_resale_status ON second_hand_listings(status);
    `);
    console.log('[MIGRATION] Construction + second-hand tables integrated.');
  } catch (e: unknown) {
    console.warn('[MIGRATION_WARN] phase3/4:', e instanceof Error ? e.message : String(e));
  }

  // Migration 7: Password reset tokens — secure, hashed, single-use, 15-min TTL
  try {
    await db.exec?.(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  TEXT NOT NULL UNIQUE,
        expires_at  TEXT NOT NULL,
        used_at     TEXT DEFAULT NULL,
        created_at  TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_prt_token   ON password_reset_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_prt_user    ON password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_prt_expires ON password_reset_tokens(expires_at);
    `);
    console.log('[MIGRATION] password_reset_tokens table integrated.');
  } catch (e: unknown) {
    console.warn('[MIGRATION_WARN] password_reset_tokens:', e instanceof Error ? e.message : String(e));
  }

  // Migration 8: Stripe payments — idempotency guard for webhook + verify flow
  try {
    await db.exec?.(`
      CREATE TABLE IF NOT EXISTS stripe_payments (
        payment_intent_id  TEXT PRIMARY KEY,
        user_id            TEXT NOT NULL REFERENCES users(id),
        amount_usd         REAL NOT NULL,
        points_granted     INTEGER NOT NULL,
        status             TEXT NOT NULL DEFAULT 'pending'
                             CHECK(status IN ('pending', 'succeeded', 'failed', 'refunded')),
        created_at         TEXT DEFAULT (datetime('now')),
        settled_at         TEXT DEFAULT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_stripe_user   ON stripe_payments(user_id);
      CREATE INDEX IF NOT EXISTS idx_stripe_status ON stripe_payments(status);
    `);
    console.log('[MIGRATION] stripe_payments table integrated.');
  } catch (e: unknown) {
    console.warn('[MIGRATION_WARN] stripe_payments:', e instanceof Error ? e.message : String(e));
  }

  // Migration 9: Web Push subscriptions — multi-device real-time notifications
  try {
    await db.exec?.(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint    TEXT NOT NULL UNIQUE,
        p256dh_key  TEXT NOT NULL,
        auth_key    TEXT NOT NULL,
        user_agent  TEXT DEFAULT NULL,
        created_at  TEXT DEFAULT (datetime('now')),
        last_used   TEXT DEFAULT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_push_user     ON push_subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_push_endpoint ON push_subscriptions(endpoint);
    `);
    console.log('[MIGRATION] push_subscriptions table integrated.');
  } catch (e: unknown) {
    console.warn('[MIGRATION_WARN] push_subscriptions:', e instanceof Error ? e.message : String(e));
  }

  // Migration 10: Redemption fulfilment fields — tracking, carrier, dispatch/delivery timestamps
  try {
    await db.exec?.("ALTER TABLE redemptions ADD COLUMN tracking_number TEXT DEFAULT NULL");
    await db.exec?.("ALTER TABLE redemptions ADD COLUMN carrier          TEXT DEFAULT NULL");
    await db.exec?.("ALTER TABLE redemptions ADD COLUMN notes            TEXT DEFAULT NULL");
    await db.exec?.("ALTER TABLE redemptions ADD COLUMN dispatched_at   TEXT DEFAULT NULL");
    await db.exec?.("ALTER TABLE redemptions ADD COLUMN delivered_at    TEXT DEFAULT NULL");
    await db.exec?.("ALTER TABLE redemptions ADD COLUMN updated_at      TEXT DEFAULT NULL");
    console.log('[MIGRATION] Redemption tracking columns added.');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg && !msg.includes('already exists') && !msg.includes('duplicate column')) {
      console.warn('[MIGRATION_WARN] redemption_tracking:', msg);
    }
  }
}

/**
 * Generates a random secure session token string.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Fetches user profile matching a session token.
 * 
 * @param token - The session token string.
 */
export async function getUserBySession(token: string | null) {
  if (!token) return null;
  const db = await getDb();
  const user = await db.prepare('SELECT * FROM users WHERE session_token = ?').get(token);
  return user || null;
}

/**
 * Creates and writes a system notification entry for a specific user.
 * 
 * @param userId - Recipient user's ID.
 * @param title - Notification title.
 * @param message - Notification body text.
 * @param type - Category: info, yield dividends, disputes, trades, or system messages.
 */
export async function createNotification(
  userId: string,
  title:  string,
  message: string,
  type: 'info' | 'yield' | 'dispute' | 'trade' | 'system' = 'info',
  pushUrl?: string        // Optional URL to open when push notification is clicked
) {
  const db = await getDb();
  await db.prepare('INSERT INTO notifications (id, user_id, title, message, type, is_read) VALUES (?, ?, ?, ?, ?, 0)')
    .run(crypto.randomUUID(), userId, title, message, type);

  // Fire Web Push to all user devices — async, non-blocking, never throws
  import('@/lib/push').then(({ sendPushToUser }) => {
    sendPushToUser(userId, {
      title,
      body:  message,
      url:   pushUrl ?? '/',
      type:  type as 'trade' | 'alert' | 'system' | 'deposit' | 'quest' | 'info',
      tag:   `tokenly-${type}-${userId}`,
    }).catch(err => console.error('[PUSH] createNotification push failed:', err));
  }).catch(() => { /* web-push not configured */ });
}

/**
 * Retrieves the last 50 notifications for a user.
 * 
 * @param userId - Target user's ID.
 */
export async function getUserNotifications(userId: string) {
  const db = await getDb();
  return await db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(userId);
}

/**
 * Fetches user profile matching a Web3 Privy DID string.
 * 
 * @param privyId - The Privy DID string.
 */
export async function getUserByPrivyId(privyId: string | null) {
  if (!privyId) return null;
  const db = await getDb();
  const user = await db.prepare('SELECT * FROM users WHERE privy_did = ?').get(privyId);
  return user || null;
}

/**
 * Checks and increments client request limits to mitigate API spam/DOS attacks.
 * 
 * @param key - The rate limit tracking key (e.g. rate:user_id:endpoint).
 * @param maxRequests - Maximum requests allowed in the window.
 * @param windowSeconds - Size of the tracking window in seconds.
 * @returns True if request is allowed, false if rate limit is exceeded.
 */
export async function checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
  const db = await getDb();
  const now = new Date().toISOString();
  // Fetch existing rate limit tracking row.
  const record = await db.prepare('SELECT * FROM rate_limits WHERE key = ?').get(key) as Record<string, unknown> | undefined;

  // If no record exists, create one and return true.
  if (!record) {
    try { 
      await db.prepare('INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)').run(key, now); 
    } catch { 
      /* Handle race inserts in parallel threads gracefully */ 
    }
    return true;
  }

  // Calculate elapsed time since the window started.
  const elapsed = (Date.now() - new Date(record.window_start as string).getTime()) / 1000;
  
  // If the window has expired, reset the counter to 1 and update timestamp.
  if (elapsed > windowSeconds) {
    await db.prepare('UPDATE rate_limits SET count = 1, window_start = ? WHERE key = ?').run(now, key);
    return true;
  }
  
  // If request count exceeds maximum limits, reject the request (return false).
  if ((record.count as number) >= maxRequests) return false;

  // Increment the request count.
  await db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').run(key);
  return true;
}

/**
 * Writes analytical logs to monitor user engagement and experiment statuses.
 * 
 * @param userId - Target user's ID.
 * @param eventType - Category of event.
 * @param data - Accompanying metadata objects.
 */
export async function logEvent(userId: string | null, eventType: string, data: Record<string, unknown>) {
  const db = await getDb();
  await db.prepare('INSERT INTO experiment_events (id, user_id, event_type, event_data) VALUES (?, ?, ?, ?)')
    .run(crypto.randomUUID(), userId, eventType, JSON.stringify(data));
}

/**
 * Fallback Consensus Recalculator: updates consensus price by averaging reviews.
 * Kept for reverse compatibility when external trade pipelines fail.
 * 
 * @param productId - Unique identifier of the product.
 * @returns Updated consensus price.
 */
export async function recalculateConsensus(productId: string): Promise<number | null> {
  const db = await getDb();
  // Fetch the target product record.
  const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as Record<string, unknown> | undefined;
  if (!product) return null;

  interface ReviewSignal { price_estimate: number; points_staked: number; }
  // Fetch estimates submitted by users.
  const reviews = await db.prepare('SELECT price_estimate, points_staked FROM reviews WHERE product_id = ?').all(productId) as ReviewSignal[];

  // If no reviews exist, return current consensus.
  if (reviews.length === 0) return product.consensus_price as number;

  let totalWeight = 0;
  let weightedSum = 0;
  
  // Weighted Average based on points staked: higher stakes dictate price consensus.
  for (const r of reviews) {
    const w = Math.max(1, r.points_staked as number);
    totalWeight += w;
    weightedSum += (r.price_estimate as number) * w;
  }
  const stakeAvg = weightedSum / totalWeight;

  // Scaling weight factor: review weight increases by 15% per review, capping at 85%.
  const reviewWeight = Math.min(0.85, 0.15 * reviews.length);
  
  // Consensus price formula combines review estimates with the fallback initial price.
  const newConsensus = Math.round(
    (stakeAvg * reviewWeight) + (((product.initial_consensus as number) || (product.retail_price as number)) * (1 - reviewWeight))
  );

  // Calculate trade counts to adjust overall confidence score.
  const tradeCountRes = await db.prepare('SELECT COUNT(*) as c FROM price_history WHERE product_id = ?').get(productId) as { c: number } | undefined;
  const tradeCount = tradeCountRes?.c || 0;
  
  // Confidence score aggregates review counts and trade ticks, capped at 95%.
  const confidence = Math.min(95, Math.round(20 + (reviews.length * 8) + (tradeCount as number * 3)));

  // Write new pricing data to products.
  await db.prepare('UPDATE products SET consensus_price = ?, price_confidence = ? WHERE id = ?').run(newConsensus, confidence, productId);
  return newConsensus;
}

/**
 * Fetches the platform status metric row (ID = 1).
 */
export async function getPlatformMetrics() {
  const db = await getDb();
  return await db.prepare('SELECT * FROM platform_metrics WHERE id = 1').get();
}

/**
 * Checks if trading has been globally halted by administrators.
 */
export async function isTradingHalted(): Promise<boolean> {
  const metrics = (await getPlatformMetrics()) as Record<string, unknown> | undefined;
  return metrics?.trading_halted === 1;
}

/** 
 * Checks for triggered price alerts and creates in-app + email notifications.
 * Called after every trade execution with the executed price.
 * 
 * @param productId - Unique identifier of the product.
 * @param currentPrice - Executed execution price of the asset.
 */
export async function checkAndFireAlerts(productId: string, currentPrice: number) {
  const db = await getDb();

  // Fetch active alerts triggered by current price — join users for email delivery
  const alerts = await db.prepare(`
    SELECT a.id, a.user_id, a.target_price, a.direction,
           u.email, u.name,
           p.name AS product_name, p.brand
    FROM alerts a
    JOIN users  u ON u.id = a.user_id
    JOIN products p ON p.id = a.product_id
    WHERE a.product_id = ? AND a.status = 'active'
    AND (
      (a.direction = 'above' AND a.target_price <= ?) OR
      (a.direction = 'below' AND a.target_price >= ?)
    )
  `).all(productId, currentPrice, currentPrice) as {
    id: string;
    user_id: string;
    target_price: number;
    direction: 'above' | 'below';
    email: string;
    name: string;
    product_name: string;
    brand: string;
  }[];

  for (const alert of alerts) {
    // Mark triggered atomically before firing side-effects
    await db.transaction(async (txDb) => {
      await txDb.prepare("UPDATE alerts SET status = 'triggered' WHERE id = ?").run(alert.id);
      await createNotification(
        alert.user_id,
        'Price Alert Triggered',
        `${alert.brand} ${alert.product_name} hit your $${alert.target_price.toLocaleString()} target. Current: $${currentPrice.toLocaleString()}.`,
        'system'
      );
    });

    // Fire email asynchronously — don't block trade execution
    import('@/lib/email').then(({ sendPriceAlertEmail }) => {
      sendPriceAlertEmail({
        email:        alert.email,
        name:         alert.name,
        productName:  alert.product_name,
        brand:        alert.brand,
        targetPrice:  alert.target_price,
        currentPrice,
        direction:    alert.direction,
        productId,
      }).catch(err => console.error('[ALERT_EMAIL] Failed to send:', err));
    }).catch(err => console.error('[ALERT_EMAIL] Module import failed:', err));

    console.log(`[ALERT] Fired alert ${alert.id} → ${alert.email} (price: $${currentPrice})`);
  }
}

/**
 * Closes the opened database connection file descriptor cleanly.
 */
export async function closeDb(): Promise<void> {
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
}
