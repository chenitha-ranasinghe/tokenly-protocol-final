/**
 * High-Performance LRU Memory Cache
 * 
 * Used for extreme multi-tier caching (L1) to serve hot data 
 * in <1ms without hitting SQLite/Postgres.
 */
class LRUCache<T> {
  private capacity: number;
  private cache: Map<string, { value: T; expiry: number }>;

  constructor(capacity: number = 500) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    // Refresh position for LRU
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key: string, value: T, ttlSeconds: number = 60): void {
    if (this.cache.size >= this.capacity) {
      // Delete oldest (first item in Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiry: Date.now() + ttlSeconds * 1000 });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global instances so they survive hot-reloads in dev
const globalForCache = global as unknown as { 
  productsCache: LRUCache<any>;
  feedCache: LRUCache<any>;
  tickerCache: LRUCache<any>;
};

export const productsCache = globalForCache.productsCache || new LRUCache(100);
export const feedCache = globalForCache.feedCache || new LRUCache(50);
export const tickerCache = globalForCache.tickerCache || new LRUCache(10);

if (process.env.NODE_ENV !== 'production') {
  globalForCache.productsCache = productsCache;
  globalForCache.feedCache = feedCache;
  globalForCache.tickerCache = tickerCache;
}
