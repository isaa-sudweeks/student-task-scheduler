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

  it('throws when NEXTAUTH_SECRET is too short', async () => {
    const original = process.env.NEXTAUTH_SECRET;
    process.env.NEXTAUTH_SECRET = 'aA1!'.repeat(7) + 'aA1';
    vi.resetModules();
    await expect(import('./env')).rejects.toThrow();
    process.env.NEXTAUTH_SECRET = original;
    vi.resetModules();
  });

  it('throws when NEXTAUTH_SECRET lacks complexity', async () => {
    const original = process.env.NEXTAUTH_SECRET;
    process.env.NEXTAUTH_SECRET = 'a'.repeat(32);
    vi.resetModules();
    await expect(import('./env')).rejects.toThrow();
    process.env.NEXTAUTH_SECRET = original;
    vi.resetModules();
  });
});
