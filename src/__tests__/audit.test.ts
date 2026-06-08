import { writeAuditLog, verifyAuditIntegrity, queryAuditLogs, generateGlobalMerkleRoot } from '@/lib/audit';
import { getDb } from '@/lib/db';

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}));

describe('audit trail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('writeAuditLog inserts row with details and ip', async () => {
    const run = jest.fn().mockResolvedValue(undefined);
    (getDb as jest.Mock).mockResolvedValue({
      prepare: jest.fn().mockReturnValue({ run }),
    });

    const id = await writeAuditLog('auth_login', 'user-1', {
      targetId: 'target-123',
      targetType: 'user',
      ipAddress: '1.1.1.1',
      details: { channel: 'test' },
    });

    expect(typeof id).toBe('string');
    expect(run).toHaveBeenCalledWith(
      id,
      expect.any(String),
      'auth_login',
      'user-1',
      'target-123',
      'user',
      JSON.stringify({ channel: 'test' }),
      '1.1.1.1',
      expect.any(String)
    );
  });

  test('verifyAuditIntegrity returns false when missing', async () => {
    (getDb as jest.Mock).mockResolvedValue({
      prepare: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue(undefined) }),
    });
    await expect(verifyAuditIntegrity('nope')).resolves.toBe(false);
  });

  test('verifyAuditIntegrity returns true for valid record, false for tampered record', async () => {
    const crypto = require('crypto');
    const details = '{"channel":"test"}';
    const timestamp = '2026-05-29T12:00:00.000Z';
    const action = 'auth_login';
    const actorId = 'user-1';
    const payload = `${action}:${actorId}:${details}:${timestamp}`;
    const dynamicHash = crypto.createHash('sha256').update(payload).digest('hex').substring(0, 16);

    const mockRecord = {
      id: 'log-123',
      timestamp,
      action,
      actor_id: actorId,
      details,
      integrity_hash: dynamicHash,
    };

    (getDb as jest.Mock).mockResolvedValue({
      prepare: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue(mockRecord) }),
    });

    // Valid integrity check
    await expect(verifyAuditIntegrity('log-123')).resolves.toBe(true);

    // Tampered integrity check (hash mismatch)
    const mockRecordTampered = { ...mockRecord, integrity_hash: 'bad-hash' };
    (getDb as jest.Mock).mockResolvedValue({
      prepare: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue(mockRecordTampered) }),
    });
    await expect(verifyAuditIntegrity('log-123')).resolves.toBe(false);
  });

  test('queryAuditLogs retrieves and filters logs', async () => {
    const mockRows = [
      {
        id: 'log-1',
        timestamp: '2026-05-29T12:00:00.000Z',
        action: 'auth_login',
        actor_id: 'user-1',
        target_id: 'target-1',
        target_type: 'user',
        details: '{"channel":"test"}',
        ip_address: '1.1.1.1',
        integrity_hash: 'hash-1',
      },
      {
        id: 'log-2',
        timestamp: '2026-05-29T13:00:00.000Z',
        action: 'trade_executed',
        actor_id: 'user-2',
        target_id: null,
        target_type: null,
        details: null, // should parse to empty object
        ip_address: null,
        integrity_hash: 'hash-2',
      },
      {
        id: 'log-3',
        timestamp: '2026-05-29T14:00:00.000Z',
        action: 'consensus_shift',
        actor_id: 'system',
        target_id: 'prod-1',
        target_type: 'product',
        details: '{invalid-json}', // should handle parsing error
        ip_address: '2.2.2.2',
        integrity_hash: 'hash-3',
      }
    ];

    const allMock = jest.fn().mockResolvedValue(mockRows);
    const prepareMock = jest.fn().mockReturnValue({ all: allMock });

    (getDb as jest.Mock).mockResolvedValue({
      prepare: prepareMock,
    });

    const logs = await queryAuditLogs({
      actorId: 'user-1',
      action: 'auth_login',
      targetId: 'target-1',
      limit: 10,
      offset: 0,
    });

    expect(prepareMock).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM audit_log WHERE 1=1 AND actor_id = ? AND action = ? AND target_id = ?')
    );
    expect(allMock).toHaveBeenCalledWith('user-1', 'auth_login', 'target-1', 10, 0);
    expect(logs).toHaveLength(3);

    // Row 1: Normal JSON details parsing
    expect(logs[0]).toEqual({
      id: 'log-1',
      timestamp: '2026-05-29T12:00:00.000Z',
      action: 'auth_login',
      actor_id: 'user-1',
      target_id: 'target-1',
      target_type: 'user',
      details: { channel: 'test' },
      ip_address: '1.1.1.1',
      integrity_hash: 'hash-1',
    });

    // Row 2: Null details parsing to empty object
    expect(logs[1].details).toEqual({});

    // Row 3: Invalid JSON details falls back to empty object
    expect(logs[2].details).toEqual({});
  });

  test('generateGlobalMerkleRoot computes hashes', async () => {
    // 1. Test empty logs case
    (getDb as jest.Mock).mockResolvedValue({
      prepare: jest.fn().mockReturnValue({ all: jest.fn().mockResolvedValue([]) }),
    });
    const emptyRoot = await generateGlobalMerkleRoot();
    expect(typeof emptyRoot).toBe('string');
    expect(emptyRoot.length).toBe(64); // sha256 is 64 hex characters

    // 2. Test rolling hash chain with multiple logs
    const mockHashes = [
      { integrity_hash: 'hash-a' },
      { integrity_hash: 'hash-b' },
    ];
    (getDb as jest.Mock).mockResolvedValue({
      prepare: jest.fn().mockReturnValue({ all: jest.fn().mockResolvedValue(mockHashes) }),
    });

    const root = await generateGlobalMerkleRoot(5);
    expect(typeof root).toBe('string');
    expect(root.length).toBe(64);
  });
});

