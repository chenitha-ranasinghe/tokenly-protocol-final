/**
 * Groq call retry + simple circuit breaker using Redis.
 * Supports serverless distributed state via Upstash.
 */
import pRetry from 'p-retry';
import { Redis } from '@upstash/redis';

let redisClient: Redis | null = null;
function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!redisClient) {
    redisClient = new Redis({ url, token });
  }
  return redisClient;
}

const OPEN_THRESHOLD = 3;
const RESET_MS = 30_000;

let localFailures = 0;
let localOpenedAt = 0;

export async function groqCircuitIsOpen(): Promise<boolean> {
  const redis = getRedis() as any;
  if (redis) {
    const failures = Number(await redis.get('groq_circuit_failures') || 0);
    if (failures < OPEN_THRESHOLD) return false;
    const openedAt = Number(await redis.get('groq_circuit_opened_at') || 0);
    if (Date.now() - openedAt > RESET_MS) {
      await redis.set('groq_circuit_failures', 0);
      return false;
    }
    return true;
  }
  if (localFailures < OPEN_THRESHOLD) return false;
  if (Date.now() - localOpenedAt > RESET_MS) {
    localFailures = 0;
    return false;
  }
  return true;
}

export async function groqCircuitRecordSuccess(): Promise<void> {
  const redis = getRedis() as any;
  if (redis) {
    await redis.set('groq_circuit_failures', 0);
  } else {
    localFailures = 0;
  }
}

export async function groqCircuitRecordFailure(): Promise<void> {
  const redis = getRedis() as any;
  if (redis) {
    const failures = await redis.incr('groq_circuit_failures');
    if (failures >= OPEN_THRESHOLD) {
      await redis.set('groq_circuit_opened_at', Date.now());
    }
  } else {
    localFailures += 1;
    if (localFailures >= OPEN_THRESHOLD) {
      localOpenedAt = Date.now();
    }
  }
}

export async function withGroqRetry<T>(fn: () => Promise<T>): Promise<T> {
  if (await groqCircuitIsOpen()) {
    throw new Error('[Groq] Circuit open — fail fast after repeated failures');
  }
  try {
    const result = await pRetry(fn, {
      retries: 3,
      factor: 2,
      minTimeout: 200,
      maxTimeout: 4000,
      onFailedAttempt: (err: { attemptNumber: number; message?: string }) => {
        console.warn(`[Groq] attempt ${err.attemptNumber} failed:`, err.message ?? err);
      },
    });
    await groqCircuitRecordSuccess();
    return result;
  } catch (e) {
    await groqCircuitRecordFailure();
    throw e;
  }
}
