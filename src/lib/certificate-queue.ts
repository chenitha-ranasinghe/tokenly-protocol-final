/**
 * Certificate PDF generation queue — BullMQ + Redis when REDIS_URL is set,
 * otherwise schedules a no-op background tick (integrate Puppeteer separately).
 */
type CertJob = { userId: string; productId: string; html: string };

/** Narrow surface so we do not depend on bullmq types at file top level. */
type CertQueue = {
  add: (name: string, data: CertJob, opts?: Record<string, unknown>) => Promise<unknown>;
};

let bullQueue: CertQueue | null = null;

async function getBullQueue(): Promise<CertQueue | null> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  if (bullQueue) return bullQueue;
  const { Queue } = await import('bullmq');
  const IORedis = (await import('ioredis')).default;
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  bullQueue = new Queue('certificate', { connection }) as CertQueue;
  return bullQueue;
}

export async function enqueueCertificateGeneration(job: CertJob): Promise<void> {
  try {
    const q = await getBullQueue();
    if (q) {
      await q.add('render', job, {
        removeOnComplete: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      });
      return;
    }
  } catch (e) {
    console.error('[certificate-queue] BullMQ unavailable:', e);
  }
  queueMicrotask(() => {
    /* Dev fallback: PDF rendering should run in a worker process, not inline. */
  });
}
