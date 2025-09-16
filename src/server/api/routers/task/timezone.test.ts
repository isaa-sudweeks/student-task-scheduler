import { describe, expect, it } from 'vitest';
import { computeTodayBounds } from './timezone';

describe('computeTodayBounds', () => {
  it('returns explicit bounds when provided', () => {
    const start = new Date('2024-01-01T00:00:00.000Z');
    const end = new Date('2024-01-01T23:59:59.999Z');
    const { startUtc, endUtc } = computeTodayBounds({
      nowUtc: new Date('2024-01-01T12:00:00Z'),
      todayStart: start,
      todayEnd: end,
    });
    expect(startUtc).toEqual(start);
    expect(endUtc).toEqual(end);
  });

  it('computes bounds for tz offset', () => {
    const now = new Date('2024-05-15T10:20:30Z');
    const { startUtc, endUtc } = computeTodayBounds({ nowUtc: now, tzOffsetMinutes: 300 });
    expect(startUtc.toISOString()).toBe('2024-05-15T05:00:00.000Z');
    expect(endUtc.toISOString()).toBe('2024-05-16T04:59:59.999Z');
  });
});
