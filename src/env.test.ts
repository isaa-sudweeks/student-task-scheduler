import { describe, it, expect, vi } from 'vitest';

describe('env validation', () => {
  it.each(['DATABASE_URL', 'NEXTAUTH_URL', 'GITHUB_ID', 'GITHUB_SECRET'])
    ('throws when %s is missing', async (key) => {
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
});
