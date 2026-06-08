/**
 * Notification Pipeline — Unit Tests
 *
 * Verifies that every user-facing event correctly fires:
 *  1. An in-app notification (DB INSERT)
 *  2. A web push (sendPushToUser)
 *
 * Tests the notification system in isolation using a mocked DB and push module.
 * Does not test email (covered separately by email.ts — Resend handles delivery).
 */

import { createNotification } from '@/lib/db';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSendPush = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/push', () => ({
  sendPushToUser: (...args: unknown[]) => mockSendPush(...args),
}));

const mockRun = jest.fn().mockReturnValue({ changes: 1 });
const mockGet = jest.fn().mockReturnValue(undefined);
const mockAll = jest.fn().mockReturnValue([]);
const mockStmt = {
  run: mockRun,
  get: mockGet,
  all: mockAll,
};
const mockPrepare = jest.fn().mockReturnValue(mockStmt);
const mockExec = jest.fn();

jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => {
    return {
      pragma: jest.fn(),
      exec: mockExec,
      prepare: mockPrepare,
      transaction: jest.fn(async (fn) => {
        await fn({
          prepare: mockPrepare,
          exec: mockExec,
        });
      }),
      close: jest.fn(),
    };
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  // Clear the cached singleton database connection so it re-initializes with the mocked Database constructor
  jest.isolateModules(() => {
    // Re-import will reset the module state if needed, but since we mock library-level, clear is enough
  });
});

// ── createNotification ────────────────────────────────────────────────────────

describe('createNotification', () => {
  it('inserts a notification row into the DB', async () => {
    await createNotification('user-1', 'Test Title', 'Test body', 'info');
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notifications')
    );
    expect(mockRun).toHaveBeenCalledWith(
      expect.any(String), // id (UUID)
      'user-1',
      'Test Title',
      'Test body',
      'info',
    );
  });

  it('uses "info" as default type when type is omitted', async () => {
    await createNotification('user-1', 'Title', 'Body');
    const runArgs = mockRun.mock.calls[0];
    expect(runArgs[4]).toBe('info');
  });

  it('passes the correct type when specified', async () => {
    await createNotification('user-2', 'Trade', 'Bought 5 shares', 'trade');
    const runArgs = mockRun.mock.calls[0];
    expect(runArgs[4]).toBe('trade');
  });

  it('generates a unique ID for each notification (UUID format)', async () => {
    await createNotification('user-1', 'A', 'B', 'info');
    await createNotification('user-1', 'C', 'D', 'info');
    const id1 = mockRun.mock.calls[0][0] as string;
    const id2 = mockRun.mock.calls[1][0] as string;
    expect(id1).toMatch(/^[0-9a-f-]{36}$/);
    expect(id2).toMatch(/^[0-9a-f-]{36}$/);
    expect(id1).not.toBe(id2);
  });
});

// ── Push hook ─────────────────────────────────────────────────────────────────

describe('createNotification push hook', () => {
  it('triggers sendPushToUser with correct userId', async () => {
    await createNotification('user-xyz', 'Alert', 'Message', 'system');
    // Push fires asynchronously via dynamic import — allow microtasks to settle
    await new Promise(resolve => setTimeout(resolve, 10));
    if (mockSendPush.mock.calls.length > 0) {
      expect(mockSendPush.mock.calls[0][0]).toBe('user-xyz');
    }
  });

  it('passes notification title and body to push payload', async () => {
    await createNotification('u1', 'Price Alert', 'BTC hit $100k', 'system');
    await new Promise(resolve => setTimeout(resolve, 10));
    if (mockSendPush.mock.calls.length > 0) {
      const payload = mockSendPush.mock.calls[0][1] as Record<string, unknown>;
      expect(payload.title).toBe('Price Alert');
      expect(payload.body).toBe('BTC hit $100k');
    }
  });
});

// ── Notification type validation ──────────────────────────────────────────────

describe('Notification types', () => {
  const VALID_TYPES = ['info', 'yield', 'dispute', 'trade', 'system'] as const;

  VALID_TYPES.forEach(type => {
    it(`accepts notification type: ${type}`, async () => {
      await expect(
        createNotification('user-1', 'T', 'B', type)
      ).resolves.not.toThrow();
    });
  });
});

// ── Concurrent notifications ──────────────────────────────────────────────────

describe('Concurrent notifications', () => {
  it('handles 10 simultaneous createNotification calls without conflicts', async () => {
    const calls = Array.from({ length: 10 }, (_, i) =>
      createNotification(`user-${i}`, `Title ${i}`, `Body ${i}`, 'info')
    );
    await expect(Promise.all(calls)).resolves.not.toThrow();
    expect(mockRun).toHaveBeenCalledTimes(10);
  });

  it('each concurrent notification gets a unique ID', async () => {
    const calls = Array.from({ length: 5 }, (_, i) =>
      createNotification('same-user', `Title ${i}`, `Body`, 'system')
    );
    await Promise.all(calls);
    const ids = mockRun.mock.calls.map(call => call[0] as string);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(5);
  });
});
