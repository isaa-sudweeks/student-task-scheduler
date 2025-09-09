import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// These tests simulate Redis errors to ensure the cache falls back to the
// in-memory Map implementation.
describe('cache with failing Redis', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.com';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    vi.mock('@upstash/redis', () => {
      return {
        Redis: class {
          get = vi.fn().mockRejectedValue(new Error('get failed'));
          set = vi.fn().mockRejectedValue(new Error('set failed'));
          scan = vi.fn().mockRejectedValue(new Error('scan failed'));
          del = vi.fn().mockRejectedValue(new Error('del failed'));
        },
      };
    });
  });

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.restoreAllMocks();
  });

  it('falls back to map for get/set operations', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { cache } = await import('@/server/cache');

    await cache.set('foo', 'bar');
    expect(await cache.get('foo')).toBe('bar');

    expect(errorSpy).toHaveBeenCalled();
  });

  it('falls back to map for deleteByPrefix', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { cache } = await import('@/server/cache');

    await cache.set('foo:1', 1);
    await cache.set('foo:2', 2);
    await cache.set('bar:1', 3);

    await cache.deleteByPrefix('foo:');

    expect(await cache.get('foo:1')).toBeNull();
    expect(await cache.get('foo:2')).toBeNull();
    expect(await cache.get('bar:1')).toBe(3);

    expect(errorSpy).toHaveBeenCalled();
  });
});
