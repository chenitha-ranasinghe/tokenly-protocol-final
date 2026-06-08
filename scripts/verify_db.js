const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'tokenly.db');
const db = new Database(dbPath);
const products = db.prepare('SELECT id, name, verification_status FROM products').all();
console.log('Products in DB:', JSON.stringify(products, null, 2));
const metrics = db.prepare('SELECT * FROM platform_metrics').all();
console.log('Metrics in DB:', JSON.stringify(metrics, null, 2));
