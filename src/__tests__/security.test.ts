import { aiVisionBodySchema } from '@/lib/validation/schemas';

describe('security — validation', () => {
  test('rejects oversized product id', () => {
    const r = aiVisionBodySchema.safeParse({
      image: 'x'.repeat(30),
      vault_id: 'a'.repeat(200),
    });
    expect(r.success).toBe(false);
  });

  test('accepts opaque ids within length bound (SQL still parameterized server-side)', () => {
    const r = aiVisionBodySchema.safeParse({
      image: 'x'.repeat(30),
      vault_id: "x'; DROP TABLE users;--".slice(0, 40),
    });
    expect(r.success).toBe(true);
  });

  test('requires image and id', () => {
    expect(aiVisionBodySchema.safeParse({}).success).toBe(false);
  });
});
