const { getDb, createNotification } = require('./src/lib/db');
const { v4: uuidv4 } = require('uuid');

async function connectAll() {
  console.log('--- Connecting V5 Protocol Components ---');
  
  try {
    const db = await getDb();
    console.log('+ Database connection established.');

    // 1. Ensure Admin User exists and has "God Mode" permissions
    const adminEmail = 'admin@tokenly.luxury';
    const existingAdmin = await db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);
    
    if (!existingAdmin) {
      console.log('+ Creating Admin User...');
      const adminId = uuidv4();
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

    // 2. Seed Protocol Pulse (First Notification)
    const admin = await db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
    if (admin) {
      await createNotification(
        admin.id,
        'PROTOCOL V5 ONLINE',
        'The Tokenly V5 core is now synchronized. All systems operational.',
        'system'
      );
      console.log('+ Initialized Protocol Pulse notification.');
    }

    // 3. Verify Product State
    const productCount = await db.prepare('SELECT COUNT(*) as c FROM products').get();
    console.log(`+ Current Product Count: ${productCount.c}`);

    console.log('--- Connection Complete: Protocol V5 is fully linked ---');
    process.exit(0);
  } catch (err) {
    console.error('Connection failed:', err);
    process.exit(1);
  }
}

connectAll();
