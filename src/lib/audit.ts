/**
 * Immutable Audit Logging System v1.0
 * 
 * Append-only audit trail for compliance on high-value asset operations.
 * Every physical asset approval, consensus shift, admin action, and 
 * security event is logged here with immutable timestamps.
 * 
 * Required for: MAS Sandbox, GDPR/PDPA, Smart Contract Audit Trails
 */

import { getDb } from './db';
import type { SQLParams } from './db-types';
import crypto from 'crypto';

export type AuditAction = 
  | 'asset_approved'
  | 'consensus_shift'
  | 'trade_executed'
  | 'review_submitted'
  | 'admin_action'
  | 'security_event'
  | 'auth_login'
  | 'auth_logout'
  | 'ai_vision'
  | 'bond_locked'
  | 'bond_released'
  | 'user_banned'
  | 'trading_halted'
  | 'data_export'
  | 'data_deletion'
  | 'construction_project_created'
  | 'construction_bid_submitted'
  | 'legal_submitted'
  | 'legal_approved'
  | 'preconstruction_token_minted'
  | 'construction_bid_accepted'
  | 'construction_milestone_verified'
  | 'resale_listing_created'
  | 'construction_approve'
  | 'construction_reject'
  | 'construction_open_bidding'
  | 'construction_close_bidding'
  | 'redemption_pending'
  | 'redemption_delivered'
  | 'redemption_cancelled'
  | 'redemption_dispatched'
  | 'products_seeded'
  | 'bim_model_uploaded'
  | 'milestones_seeded'
  | 'milestone_submitted'
  | 'milestone_verified'
  | 'milestone_rejected'
  | 'investor_dashboard_access'
  | 'redemption_initiated';

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  actor_id: string;
  target_id?: string;
  target_type?: string;
  details: Record<string, unknown>;
  ip_address?: string;
  integrity_hash: string;
}



/**
 * Create an integrity hash for tamper detection
 */
function createIntegrityHash(action: string, actorId: string, details: string, timestamp: string): string {
  const payload = `${action}:${actorId}:${details}:${timestamp}`;
  return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 16);
}

/**
 * Write an immutable audit log entry
 */
export async function writeAuditLog(
  action: AuditAction,
  actorId: string,
  options: {
    targetId?: string;
    targetType?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
  } = {}
): Promise<string> {
  const db = await getDb();

  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const detailsJson = JSON.stringify(options.details || {});
  const hash = createIntegrityHash(action, actorId, detailsJson, timestamp);

  await db.prepare(`
    INSERT INTO audit_log (id, timestamp, action, actor_id, target_id, target_type, details, ip_address, integrity_hash) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, timestamp, action, actorId, options.targetId || null, options.targetType || null, detailsJson, options.ipAddress || null, hash);

  return id;
}

/**
 * Query audit logs with filters (read-only)
 */
export async function queryAuditLogs(filters: {
  actorId?: string;
  action?: AuditAction;
  targetId?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditEntry[]> {
  const db = await getDb();

  let sql = 'SELECT * FROM audit_log WHERE 1=1';
  const params: (string | number | boolean | null)[] = [];

  if (filters.actorId) { sql += ' AND actor_id = ?'; params.push(filters.actorId); }
  if (filters.action) { sql += ' AND action = ?'; params.push(filters.action); }
  if (filters.targetId) { sql += ' AND target_id = ?'; params.push(filters.targetId); }

  sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(filters.limit || 100, filters.offset || 0);

  const rows = (await db.prepare(sql).all(...(params as SQLParams))) as Record<string, unknown>[];
  return rows.map((r): AuditEntry => {
    const detailsRaw = r.details;
    let details: Record<string, unknown> = {};
    if (typeof detailsRaw === 'string') {
      try {
        details = JSON.parse(detailsRaw || '{}') as Record<string, unknown>;
      } catch {
        details = {};
      }
    } else if (detailsRaw && typeof detailsRaw === 'object' && !Array.isArray(detailsRaw)) {
      details = detailsRaw as Record<string, unknown>;
    }
    return {
      id: String(r.id ?? ''),
      timestamp: String(r.timestamp ?? ''),
      action: r.action as AuditAction,
      actor_id: String(r.actor_id ?? ''),
      target_id: r.target_id != null ? String(r.target_id) : undefined,
      target_type: r.target_type != null ? String(r.target_type) : undefined,
      details,
      ip_address: r.ip_address != null ? String(r.ip_address) : undefined,
      integrity_hash: String(r.integrity_hash ?? ''),
    };
  });
}

/**
 * Verify integrity of audit log entries (tamper detection)
 */
export async function verifyAuditIntegrity(entryId: string): Promise<boolean> {
  const db = await getDb();

  const entry = await db.prepare('SELECT * FROM audit_log WHERE id = ?').get(entryId) as Record<string, unknown> | undefined;
  if (!entry) return false;

  const detailsStr = typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details ?? {});
  const expectedHash = createIntegrityHash(
    String(entry.action),
    String(entry.actor_id),
    detailsStr,
    String(entry.timestamp)
  );
  return expectedHash === entry.integrity_hash;
}
/**
 * Generate a Global Merkle Root for the last N audit logs
 * This provides cryptographic proof that the audit trail has not been tampered with
 * from the outside.
 */
export async function generateGlobalMerkleRoot(limit: number = 1000): Promise<string> {
  const db = await getDb();
  
  // Get logs in ascending chronological order for chaining
  const logs = await db.prepare(`
    SELECT integrity_hash FROM audit_log 
    ORDER BY timestamp ASC LIMIT ?
  `).all(limit) as { integrity_hash: string }[];

  if (logs.length === 0) return crypto.createHash('sha256').update('GENESIS').digest('hex');

  // Rolling hash chain (simplified Merkle path for append-only logs)
  let currentRoot = crypto.createHash('sha256').update('GENESIS').digest('hex');
  
  for (const log of logs) {
    currentRoot = crypto.createHash('sha256')
      .update(currentRoot + log.integrity_hash)
      .digest('hex');
  }

  return currentRoot;
}
