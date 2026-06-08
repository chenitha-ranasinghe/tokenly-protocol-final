/**
 * @jest-environment node
 */
import { runAiVision } from '@/lib/services/ai-vision-service';
import * as groq from '@/lib/groq';
import * as audit from '@/lib/audit';
import * as db from '@/lib/db';
import type { User } from '@/lib/types';

jest.mock('@/lib/groq', () => ({
  ...jest.requireActual('@/lib/groq'),
  groqChat: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}));

jest.mock('@/lib/audit', () => ({
  writeAuditLog: jest.fn().mockResolvedValue('audit-id'),
}));

const mockUser = {
  id: 'u1',
  email: 't@test.com',
  name: 'T',
  wallet_address: undefined,
  points: 1000,
  experiment_group: 'staking' as const,
  total_reviews: 0,
  accurate_reviews: 0,
  rrs_score: 50,
  created_at: new Date().toISOString(),
  is_admin: 0,
  is_id_verified: 0,
};

describe('AI Vision service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.getDb as jest.Mock).mockResolvedValue({
      prepare: () => ({
        get: jest.fn().mockResolvedValue({
          name: 'Test Shoe',
          brand: 'Brand',
          sku: 'SKU-1',
          category: 'Sneakers',
        }),
      }),
    });
  });

  test('success path parses Groq JSON', async () => {
    (groq.groqChat as jest.Mock).mockResolvedValue(
      JSON.stringify({
        verdict: 'AUTHENTIC',
        confidence: 92,
        notes: 'Looks good.',
        forensics: [],
      })
    );
    const r = await runAiVision({
      user: mockUser as User,
      imageBase64: 'a'.repeat(40),
      productId: 'p1',
    });
    expect(r.authenticated).toBe(true);
    expect(r.confidence).toBeGreaterThan(0.9);
    expect(audit.writeAuditLog).toHaveBeenCalled();
  });

  test('inconclusive lowers authenticated flag', async () => {
    (groq.groqChat as jest.Mock).mockResolvedValue(
      JSON.stringify({
        verdict: 'INCONCLUSIVE',
        confidence: 40,
        notes: 'Unclear.',
        forensics: [],
      })
    );
    const r = await runAiVision({
      user: mockUser as User,
      imageBase64: 'b'.repeat(40),
      productId: 'p1',
    });
    expect(r.authenticated).toBe(false);
  });

  test('Groq failure propagates', async () => {
    (groq.groqChat as jest.Mock).mockRejectedValue(new Error('timeout'));
    await expect(
      runAiVision({ user: mockUser as User, imageBase64: 'c'.repeat(40), productId: 'p1' })
    ).rejects.toThrow('timeout');
  });
});
