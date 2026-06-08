/**
 * Shallow module declarations so `tsc --noEmit` can run before optional
 * dependencies finish installing (slow networks / CI cold cache).
 * Real types come from node_modules once `npm install` completes.
 */
declare module 'bullmq' {
  export class Queue {
    constructor(name: string, opts: { connection: unknown });
    add(name: string, data: unknown, opts?: unknown): Promise<unknown>;
  }
}

declare module 'ioredis' {
  const IORedis: new (url: string, opts?: Record<string, unknown>) => unknown;
  export default IORedis;
}

declare module 'p-retry' {
  export interface Options {
    retries?: number;
    factor?: number;
    minTimeout?: number;
    maxTimeout?: number;
    onFailedAttempt?: (error: { attemptNumber: number; message?: string }) => void;
  }
  export default function pRetry<T>(input: () => Promise<T>, options?: Options): Promise<T>;
}

declare module 'prom-client' {
  export class Registry {
    metrics(): Promise<string>;
    contentType: string;
  }
  export function collectDefaultMetrics(opts: { register: Registry; prefix?: string }): void;

  export class Counter {
    constructor(opts: {
      name: string;
      help: string;
      labelNames?: string[];
      registers?: Registry[];
    });
    inc(labels?: Record<string, string> | number, value?: number): void;
  }

  export class Histogram {
    constructor(opts: {
      name: string;
      help: string;
      labelNames?: string[];
      buckets?: number[];
      registers?: Registry[];
    });
    observe(labelsOrValue: Record<string, string> | number, value?: number): void;
  }
}

declare module '@upstash/ratelimit' {
  export class Ratelimit {
    static slidingWindow(requests: number, window: string): unknown;
    constructor(opts: Record<string, unknown>);
    limit(id: string): Promise<{ success: boolean; remaining?: number }>;
  }
}

declare module '@upstash/redis' {
  export class Redis {
    constructor(opts: Record<string, unknown>);
    ping(): Promise<string>;
  }
}
