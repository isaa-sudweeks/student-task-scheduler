import { describe, it, expect, vi } from 'vitest';

describe('env validation', () => {
  it('throws when required env vars are missing', async () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    vi.resetModules();
    await expect(import('./env')).rejects.toThrow();
    process.env.DATABASE_URL = original;
    vi.resetModules();
  });
});
