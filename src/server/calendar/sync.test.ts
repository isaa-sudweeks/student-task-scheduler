import { describe, expect, it, vi } from 'vitest';

vi.mock('./providers', () => ({
  getCalendarProviderAdapter: () => undefined,
}));

vi.mock('@prisma/client', async () => {
  const actual = await vi.importActual<typeof import('@prisma/client')>('@prisma/client');
  return actual;
});

import { parseExternalRefs, resolveProvidersForUser } from './sync';

type Provider = ReturnType<typeof resolveProvidersForUser>[number];
const GOOGLE = 'GOOGLE' as Provider;
const MICROSOFT = 'MICROSOFT' as Provider;
const APPLE = 'APPLE' as Provider;

describe('resolveProvidersForUser', () => {
  it('returns unique providers', () => {
    const providers = resolveProvidersForUser([GOOGLE, MICROSOFT, GOOGLE], false);
    expect(providers).toEqual([GOOGLE, MICROSOFT]);
  });

  it('includes Google when enabled', () => {
    const providers = resolveProvidersForUser([APPLE], true);
    expect(providers).toContain(GOOGLE);
    expect(providers).toContain(APPLE);
  });

  it('returns empty when sync is disabled', () => {
    const providers = resolveProvidersForUser([], false);
    expect(providers).toEqual([]);
  });
});

describe('parseExternalRefs', () => {
  it('extracts string values for providers', () => {
    const result = parseExternalRefs({ GOOGLE: 'g-1', APPLE: 123, MICROSOFT: 'm-2' });
    expect(result).toEqual({
      [GOOGLE]: 'g-1',
      [MICROSOFT]: 'm-2',
    });
  });

  it('returns empty object for invalid input', () => {
    expect(parseExternalRefs(null)).toEqual({});
    expect(parseExternalRefs(['GOOGLE'] as unknown as Record<string, unknown>)).toEqual({});
  });
});
