import { describe, it, expect, vi } from 'vitest';

describe('env validation', () => {
  it.each([
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
  ])('throws when %s is missing', async (key) => {
    const original = process.env[key];
    delete process.env[key];
    vi.resetModules();
    await expect(import('./env')).rejects.toThrow();
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
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

  it('allows importing without GitHub credentials', async () => {
    const originalId = process.env.GITHUB_ID;
    const originalSecret = process.env.GITHUB_SECRET;
    delete process.env.GITHUB_ID;
    delete process.env.GITHUB_SECRET;
    vi.resetModules();
    await expect(import('./env')).resolves.toBeDefined();
    if (originalId === undefined) {
      delete process.env.GITHUB_ID;
    } else {
      process.env.GITHUB_ID = originalId;
    }
    if (originalSecret === undefined) {
      delete process.env.GITHUB_SECRET;
    } else {
      process.env.GITHUB_SECRET = originalSecret;
    }
    vi.resetModules();
  });
});
