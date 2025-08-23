import { Redis } from '@upstash/redis';

interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  clear(): Promise<void>;
}

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN;

let store: CacheStore;

if (url && token) {
  const redis = new Redis({ url, token });
  store = {
    async get<T>(key: string) {
      return (await redis.get<T>(key)) ?? null;
    },
    async set<T>(key: string, value: T, ttlSeconds?: number) {
      await redis.set(key, value, ttlSeconds ? { ex: ttlSeconds } : undefined);
    },
    async clear() {
      await redis.flushdb();
    },
  };
} else {
  const map = new Map<string, { value: unknown; expires: number | null }>();
  store = {
    async get<T>(key: string) {
      const entry = map.get(key);
      if (!entry) return null;
      if (entry.expires && entry.expires < Date.now()) {
        map.delete(key);
        return null;
      }
      return entry.value as T;
    },
    async set<T>(key: string, value: T, ttlSeconds?: number) {
      map.set(key, { value, expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
    },
    async clear() {
      map.clear();
    },
  };
}

export const cache: CacheStore = store;

