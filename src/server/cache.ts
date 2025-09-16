import { Redis } from '@upstash/redis';
import { env } from '@/env';
import { logger } from '@/server/logger';

export const CACHE_PREFIX = 'task:';

interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  deleteByPrefix(prefix: string): Promise<void>;
  clear(): Promise<void>;
}

const url = env.UPSTASH_REDIS_REST_URL ?? env.REDIS_URL;
const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.REDIS_TOKEN;

const map = new Map<string, { value: unknown; expires: number | null }>();
const mapStore: CacheStore = {
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
  async deleteByPrefix(prefix: string) {
    for (const key of Array.from(map.keys())) {
      if (key.startsWith(prefix)) {
        map.delete(key);
      }
    }
  },
  async clear() {
    await this.deleteByPrefix(CACHE_PREFIX);
  },
};

let store: CacheStore;
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

if (url && token) {
  const redis = new Redis({ url, token });
  store = {
    async get<T>(key: string) {
      try {
        return (await redis.get<T>(key)) ?? null;
      } catch (err) {
        logger.error('Redis get error', err);
        return mapStore.get<T>(key);
      }
    },
    async set<T>(key: string, value: T, ttlSeconds?: number) {
      try {
        await redis.set(key, value, ttlSeconds ? { ex: ttlSeconds } : undefined);
      } catch (err) {
        logger.error('Redis set error', err);
        await mapStore.set(key, value, ttlSeconds);
      }
    },
    async deleteByPrefix(prefix: string) {
      try {
        let cursor = 0;
        do {
          const [nextCursor, keys] = await redis.scan(cursor, {
            match: `${prefix}*`,
            count: 100,
          });
          if (keys.length) {
            await redis.del(...keys);
          }
          cursor = Number(nextCursor);
        } while (cursor !== 0);
      } catch (err) {
        logger.error('Redis deleteByPrefix error', err);
        await mapStore.deleteByPrefix(prefix);
      }
    },
    async clear() {
      try {
        await this.deleteByPrefix(CACHE_PREFIX);
      } catch (err) {
        logger.error('Redis clear error', err);
        await mapStore.clear();
      }
    },
  };
} else {
  // Use in-memory map store and prune expired entries periodically.
  store = mapStore;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, { expires }] of map.entries()) {
      if (expires && expires < now) {
        map.delete(key);
      }
    }
  }, 60_000);
}

export const cache: CacheStore = store;

export function dispose() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
