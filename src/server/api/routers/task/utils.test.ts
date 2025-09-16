import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/db', () => ({ db: {} }));
vi.mock('@/server/cache', () => ({ cache: { deleteByPrefix: vi.fn() } }));

import { buildListCacheKey, validateRecurrence } from './utils';
import { RecurrenceType } from '@prisma/client';
import { TRPCError } from '@trpc/server';

describe('buildListCacheKey', () => {
  it('produces identical keys regardless of property order', () => {
    const user = 'u1';
    const first = { b: 2, a: 1, nested: { z: 1, y: 2 } };
    const second = { nested: { y: 2, z: 1 }, a: 1, b: 2 };
    const key1 = buildListCacheKey(first, user);
    const key2 = buildListCacheKey(second, user);
    expect(key1).toBe(key2);
  });
});

describe('validateRecurrence', () => {
  it('throws when both recurrenceCount and recurrenceUntil are provided', () => {
    expect(() =>
      validateRecurrence({
        recurrenceType: RecurrenceType.DAILY,
        recurrenceInterval: 1,
        recurrenceCount: 2,
        recurrenceUntil: new Date(),
      }),
    ).toThrow(TRPCError);
  });

  it('requires a non-NONE recurrenceType when other fields exist', () => {
    expect(() =>
      validateRecurrence({ recurrenceInterval: 2 }),
    ).toThrow(TRPCError);
    expect(() =>
      validateRecurrence({
        recurrenceType: RecurrenceType.NONE,
        recurrenceUntil: new Date(),
      }),
    ).toThrow(TRPCError);
  });

  it('accepts valid recurrence details', () => {
    expect(() =>
      validateRecurrence({
        recurrenceType: RecurrenceType.WEEKLY,
        recurrenceInterval: 1,
      }),
    ).not.toThrow();
  });
});

