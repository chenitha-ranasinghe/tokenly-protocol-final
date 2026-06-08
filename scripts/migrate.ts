/**
 * Apply SQL migrations from `migrations/` in lexical order.
 * Uses the same `getDb` abstraction as the app (SQLite or Postgres).
 */
import fs from 'fs';
import path from 'path';
import { getDb } from '../src/lib/db';

async function main(): Promise<void> {
  const dir = path.join(process.cwd(), 'migrations');
  if (!fs.existsSync(dir)) {
    console.log('[migrate] No migrations directory — nothing to do.');
    return;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const db = await getDb();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`[migrate] Applying ${file} …`);
    await db.exec(sql);
  }
  console.log('[migrate] Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
