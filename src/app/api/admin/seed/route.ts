/**
 * POST /api/admin/seed
 *
 * One-time product seeding endpoint. Inserts 25 curated luxury products
 * spanning watches, sneakers, spirits, bags, and art collectibles.
 *
 * Safety: Only runs when products table is empty, or when { force: true } is sent.
 * Admin auth required. Audit-logged.
 *
 * Usage:
 *   POST /api/admin/seed          → seeds if DB is empty
 *   POST /api/admin/seed { "force": true }  → re-seeds even if products exist
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { authenticateRequest, isAdmin } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { jsonError } from '@/lib/api-response';

// ── Product Catalogue ─────────────────────────────────────────────────────────

interface SeedProduct {
  name:             string;
  brand:            string;
  sku:              string;
  category:         string;
  retail_price:     number;
  market_price_low:  number;
  market_price_high: number;
  consensus_price:  number;
  total_tokens:     number;
  vault_location:   string;
  description:      string;
  verification_status: 'certified' | 'pending';
}

const SEED_PRODUCTS: SeedProduct[] = [
  // ── Luxury Watches ──────────────────────────────────────────────────────
  {
    name: 'Submariner Date 126610LN',
    brand: 'Rolex', sku: 'ROL-SUB-126610LN',
    category: 'Luxury Watches',
    retail_price: 10450, market_price_low: 14800, market_price_high: 16200, consensus_price: 15500,
    total_tokens: 1000, vault_location: 'SG-MAIN · Singapore',
    description: 'Rolex Submariner in Oystersteel. Black dial, Cerachrom bezel. 2024 production.',
    verification_status: 'certified',
  },
  {
    name: 'Nautilus 5711/1A-010',
    brand: 'Patek Philippe', sku: 'PP-NAU-5711-1A',
    category: 'Luxury Watches',
    retail_price: 34435, market_price_low: 95000, market_price_high: 130000, consensus_price: 112000,
    total_tokens: 1000, vault_location: 'SG-MAIN · Singapore',
    description: 'Patek Philippe Nautilus ref. 5711 in stainless steel. Blue sunburst dial. Discontinued 2021.',
    verification_status: 'certified',
  },
  {
    name: 'Royal Oak 15510ST',
    brand: 'Audemars Piguet', sku: 'AP-RO-15510ST-OO',
    category: 'Luxury Watches',
    retail_price: 26800, market_price_low: 28000, market_price_high: 32000, consensus_price: 30000,
    total_tokens: 1000, vault_location: 'SG-MAIN · Singapore',
    description: 'AP Royal Oak 41mm Selfwinding. Blue dial, integrated bracelet. 2024 current reference.',
    verification_status: 'certified',
  },
  {
    name: 'Daytona 116500LN',
    brand: 'Rolex', sku: 'ROL-DAY-116500LN-WH',
    category: 'Luxury Watches',
    retail_price: 13150, market_price_low: 28000, market_price_high: 35000, consensus_price: 31500,
    total_tokens: 1000, vault_location: 'SG-MAIN · Singapore',
    description: 'Rolex Cosmograph Daytona in Oystersteel. White Panda dial, Cerachrom bezel.',
    verification_status: 'certified',
  },
  {
    name: 'Calatrava 5196P',
    brand: 'Patek Philippe', sku: 'PP-CAL-5196P-001',
    category: 'Luxury Watches',
    retail_price: 28000, market_price_low: 32000, market_price_high: 40000, consensus_price: 36000,
    total_tokens: 1000, vault_location: 'SG-MAIN · Singapore',
    description: 'Patek Philippe Calatrava in platinum. Silver opaline dial. Classic dress watch.',
    verification_status: 'certified',
  },
  // ── Sneakers ────────────────────────────────────────────────────────────
  {
    name: 'Air Jordan 1 Retro High OG "Chicago"',
    brand: 'Nike / Jordan Brand', sku: 'NJB-AJ1-CHICAGO-10',
    category: 'Sneakers',
    retail_price: 170, market_price_low: 1200, market_price_high: 1600, consensus_price: 1400,
    total_tokens: 1000, vault_location: 'MY-KUL · Kuala Lumpur',
    description: 'Air Jordan 1 High OG Chicago 2015 release. Size 10 US. DS unworn in OG box.',
    verification_status: 'certified',
  },
  {
    name: 'Travis Scott × AJ1 Low "Mocha"',
    brand: 'Nike / Jordan Brand', sku: 'NJB-TS-AJ1L-MOCHA-10',
    category: 'Sneakers',
    retail_price: 150, market_price_low: 800, market_price_high: 1100, consensus_price: 950,
    total_tokens: 1000, vault_location: 'MY-KUL · Kuala Lumpur',
    description: 'Travis Scott × Air Jordan 1 Low "Mocha". Size 10 US. Swapped laces included.',
    verification_status: 'certified',
  },
  {
    name: 'Dunk Low "Panda"',
    brand: 'Nike', sku: 'NIK-DL-DD1391-100-10',
    category: 'Sneakers',
    retail_price: 110, market_price_low: 140, market_price_high: 200, consensus_price: 165,
    total_tokens: 500, vault_location: 'MY-KUL · Kuala Lumpur',
    description: 'Nike Dunk Low White/Black "Panda". Size 10 US. 2024 restock. DS.',
    verification_status: 'pending',
  },
  {
    name: 'Off-White × Air Jordan 4 "Sail"',
    brand: 'Nike / Off-White', sku: 'OW-AJ4-SAIL-10',
    category: 'Sneakers',
    retail_price: 200, market_price_low: 2200, market_price_high: 3000, consensus_price: 2600,
    total_tokens: 1000, vault_location: 'SG-MAIN · Singapore',
    description: 'Off-White × Air Jordan 4 "Sail" by Virgil Abloh. Size 10 US. DS with all tags.',
    verification_status: 'certified',
  },
  {
    name: 'New Balance 550 "White Navy"',
    brand: 'New Balance', sku: 'NB-550-BB550WT1-10',
    category: 'Sneakers',
    retail_price: 110, market_price_low: 130, market_price_high: 180, consensus_price: 150,
    total_tokens: 500, vault_location: 'MY-KUL · Kuala Lumpur',
    description: 'New Balance 550 White Navy. Size 10 US. 2023 release. DS.',
    verification_status: 'pending',
  },
  // ── Fine Spirits ─────────────────────────────────────────────────────────
  {
    name: 'Family Reserve 23 Year',
    brand: 'Pappy Van Winkle', sku: 'PVW-FR-23-750ML',
    category: 'Fine Spirits',
    retail_price: 360, market_price_low: 3500, market_price_high: 5000, consensus_price: 4200,
    total_tokens: 1000, vault_location: 'LK-COL · Colombo',
    description: 'Pappy Van Winkle Family Reserve 23 Year. 750ml. 2022 Buffalo Trace release. Sealed.',
    verification_status: 'certified',
  },
  {
    name: 'The Macallan 18 Year Sherry Oak',
    brand: 'The Macallan', sku: 'MAC-18-SH-750ML-2020',
    category: 'Fine Spirits',
    retail_price: 300, market_price_low: 380, market_price_high: 500, consensus_price: 440,
    total_tokens: 500, vault_location: 'LK-COL · Colombo',
    description: 'The Macallan 18 Year Old Sherry Oak. 750ml. 2020 bottling. Sealed in original box.',
    verification_status: 'certified',
  },
  {
    name: 'Yamazaki 18 Year Single Malt',
    brand: 'Suntory', sku: 'SUN-YAM-18-700ML',
    category: 'Fine Spirits',
    retail_price: 350, market_price_low: 800, market_price_high: 1100, consensus_price: 950,
    total_tokens: 500, vault_location: 'SG-MAIN · Singapore',
    description: 'Suntory Yamazaki 18 Year Single Malt. 700ml. Japanese whisky. Sealed.',
    verification_status: 'certified',
  },
  {
    name: 'Hibiki 21 Year Blended',
    brand: 'Suntory', sku: 'SUN-HIB-21-700ML',
    category: 'Fine Spirits',
    retail_price: 400, market_price_low: 1200, market_price_high: 1800, consensus_price: 1500,
    total_tokens: 500, vault_location: 'SG-MAIN · Singapore',
    description: 'Suntory Hibiki 21 Year Japanese Blended Whisky. 700ml. Limited release. Sealed.',
    verification_status: 'certified',
  },
  {
    name: 'George T. Stagg 2022',
    brand: 'Buffalo Trace', sku: 'BT-GTS-2022-750ML',
    category: 'Fine Spirits',
    retail_price: 100, market_price_low: 700, market_price_high: 950, consensus_price: 820,
    total_tokens: 500, vault_location: 'LK-COL · Colombo',
    description: 'George T. Stagg Uncut/Unfiltered Kentucky Bourbon 2022 release. 750ml. BTAC.',
    verification_status: 'certified',
  },
  // ── Luxury Bags ──────────────────────────────────────────────────────────
  {
    name: 'Birkin 30 Togo Gold GHW',
    brand: 'Hermès', sku: 'HER-BK30-TOGO-GOLD-GHW',
    category: 'Luxury Bags',
    retail_price: 10900, market_price_low: 20000, market_price_high: 28000, consensus_price: 24000,
    total_tokens: 1000, vault_location: 'SG-MAIN · Singapore',
    description: 'Hermès Birkin 30 in Gold Togo Leather with Gold Hardware. Brand new with receipt.',
    verification_status: 'certified',
  },
  {
    name: 'Classic Flap Medium Caviar Black GHW',
    brand: 'Chanel', sku: 'CHA-CF-MED-CAV-BLK-GHW',
    category: 'Luxury Bags',
    retail_price: 9500, market_price_low: 10000, market_price_high: 13500, consensus_price: 11800,
    total_tokens: 1000, vault_location: 'SG-MAIN · Singapore',
    description: 'Chanel Classic Double Flap Medium in Black Caviar with Gold Hardware. 2023. DS.',
    verification_status: 'certified',
  },
  {
    name: 'Kelly 28 Epsom Noir PHW',
    brand: 'Hermès', sku: 'HER-KL28-EPS-NOIR-PHW',
    category: 'Luxury Bags',
    retail_price: 8800, market_price_low: 16000, market_price_high: 22000, consensus_price: 19000,
    total_tokens: 1000, vault_location: 'SG-MAIN · Singapore',
    description: 'Hermès Kelly 28 Sellier in Noir Epsom Leather with Palladium Hardware. Unused.',
    verification_status: 'certified',
  },
  // ── Art & Collectibles ────────────────────────────────────────────────────
  {
    name: 'KAWS BFF Pink Open Edition',
    brand: 'KAWS', sku: 'KAWS-BFF-PINK-OE-2021',
    category: 'Art & Collectibles',
    retail_price: 65, market_price_low: 95, market_price_high: 150, consensus_price: 120,
    total_tokens: 500, vault_location: 'MY-KUL · Kuala Lumpur',
    description: 'KAWS BFF Open Edition Vinyl Figure in Pink. 2021. Sealed in original box.',
    verification_status: 'certified',
  },
  {
    name: 'Bearbrick Medicom Toy 1000% Warhol Banana',
    brand: 'Medicom Toy', sku: 'MED-BB1000-WARHOL-BAN',
    category: 'Art & Collectibles',
    retail_price: 480, market_price_low: 1200, market_price_high: 1800, consensus_price: 1500,
    total_tokens: 1000, vault_location: 'SG-MAIN · Singapore',
    description: 'Medicom Toy BE@RBRICK 1000% Andy Warhol Banana. Limited edition. Mint in box.',
    verification_status: 'certified',
  },
  {
    name: 'BAPE Ape Head #1 Lithograph',
    brand: 'A Bathing Ape', sku: 'BAPE-APE1-LITHO-SN-250',
    category: 'Art & Collectibles',
    retail_price: 250, market_price_low: 400, market_price_high: 650, consensus_price: 520,
    total_tokens: 500, vault_location: 'MY-KUL · Kuala Lumpur',
    description: 'A Bathing Ape Ape Head Signed Lithograph. Edition of 250. Framed. COA included.',
    verification_status: 'certified',
  },
  // ── Trading Cards ─────────────────────────────────────────────────────────
  {
    name: 'Charizard Base Set Shadowless Holo PSA 9',
    brand: 'Pokémon / Wizards', sku: 'PKM-CHAR-BASE-SHAD-PSA9',
    category: 'Trading Cards',
    retail_price: 0, market_price_low: 4800, market_price_high: 6500, consensus_price: 5600,
    total_tokens: 1000, vault_location: 'SG-MAIN · Singapore',
    description: 'Pokémon Charizard Base Set Shadowless Holo Rare. PSA graded Mint 9. 1999.',
    verification_status: 'certified',
  },
  {
    name: 'Pikachu Illustrator PSA 8',
    brand: 'Pokémon / CoroCoro', sku: 'PKM-PIKA-ILLUS-PSA8',
    category: 'Trading Cards',
    retail_price: 0, market_price_low: 50000, market_price_high: 80000, consensus_price: 65000,
    total_tokens: 1000, vault_location: 'SG-MAIN · Singapore',
    description: 'Pokémon Pikachu Illustrator 1998. PSA graded Near Mint-Mint 8. Rarest Pokémon card.',
    verification_status: 'certified',
  },
  {
    name: 'Lionel Messi 2004 Topps Rookie RC BGS 9',
    brand: 'Topps', sku: 'TOP-MESSI-2004-RC-BGS9',
    category: 'Trading Cards',
    retail_price: 0, market_price_low: 18000, market_price_high: 26000, consensus_price: 22000,
    total_tokens: 1000, vault_location: 'SG-MAIN · Singapore',
    description: 'Lionel Messi 2004 Topps Rookie Card. BGS graded 9 Mint. First mainstream Messi RC.',
    verification_status: 'certified',
  },
  {
    name: 'Michael Jordan 1986 Fleer #57 BGS 8.5',
    brand: 'Fleer', sku: 'FLE-MJ-1986-57-BGS85',
    category: 'Trading Cards',
    retail_price: 0, market_price_low: 6000, market_price_high: 9000, consensus_price: 7500,
    total_tokens: 1000, vault_location: 'MY-KUL · Kuala Lumpur',
    description: 'Michael Jordan 1986-87 Fleer Rookie Card #57. BGS graded NM-MT+ 8.5.',
    verification_status: 'certified',
  },
];

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await authenticateRequest(request);
  if (!user || !isAdmin(user)) return jsonError('Admin access required.', 401, 'UNAUTHORIZED');

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { /* empty body ok */ }

  const force = body.force === true;

  const db = await getDb();

  // Safety check
  const existing = await db
    .prepare('SELECT COUNT(*) as c FROM products')
    .get() as { c: number };

  if (existing.c > 0 && !force) {
    return NextResponse.json({
      skipped: true,
      message: `Database already contains ${existing.c} products. Send { "force": true } to re-seed.`,
      count: existing.c,
    });
  }

  if (force && existing.c > 0) {
    // Clear existing products and related data
    await db.exec?.(`
      DELETE FROM user_shares WHERE 1=1;
      DELETE FROM orders WHERE 1=1;
      DELETE FROM authentications WHERE 1=1;
      DELETE FROM reviews WHERE 1=1;
      DELETE FROM alerts WHERE 1=1;
      DELETE FROM products WHERE 1=1;
    `);
  }

  let inserted = 0;
  const insertedIds: string[] = [];

  for (const p of SEED_PRODUCTS) {
    const id = uuidv4();
    await db
      .prepare(
        `INSERT INTO products
           (id, name, brand, sku, category, retail_price,
            market_price_low, market_price_high, consensus_price, initial_consensus,
            total_tokens, price_confidence, vault_location, description, verification_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        p.name, p.brand, p.sku, p.category,
        p.retail_price,
        p.market_price_low, p.market_price_high,
        p.consensus_price, p.consensus_price,   // initial_consensus = consensus_price at seed
        p.total_tokens,
        p.verification_status === 'certified' ? 75 : 20,
        p.vault_location,
        p.description,
        p.verification_status,
      );
    insertedIds.push(id);
    inserted++;
  }

  await writeAuditLog('products_seeded', String(user.id), {
    details:   { count: inserted, force, categories: [...new Set(SEED_PRODUCTS.map(p => p.category))] },
    ipAddress: request.headers.get('x-forwarded-for') ?? 'unknown',
  });

  console.info(`[SEED] Admin ${user.id} seeded ${inserted} products`);

  return NextResponse.json({
    success:  true,
    inserted,
    message:  `Seeded ${inserted} luxury products across ${[...new Set(SEED_PRODUCTS.map(p => p.category))].length} categories.`,
    ids:      insertedIds,
  }, { status: 201 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await authenticateRequest(request);
  if (!user || !isAdmin(user)) return jsonError('Admin access required.', 401, 'UNAUTHORIZED');

  const db = await getDb();
  const count = (await db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }).c;
  const cats  = await db.prepare('SELECT category, COUNT(*) as c FROM products GROUP BY category').all();

  return NextResponse.json({
    productCount: count,
    seedCount:    SEED_PRODUCTS.length,
    seeded:       count > 0,
    categories:   cats,
    message:      count === 0
      ? 'Database is empty. POST to /api/admin/seed to insert products.'
      : `${count} products in database.`,
  });
}
