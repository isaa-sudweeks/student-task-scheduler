import { describe, expect, it, vi } from 'vitest';
import {
  calculateDurationMinutes,
  defaultEndOfToday,
  formatLocalDateTime,
  parseLocalDateTime,
} from '@/lib/datetime';

describe('datetime utilities', () => {
  it('formats dates using the HTML datetime-local pattern', () => {
    const date = new Date('2024-03-05T07:42:13Z');
    expect(formatLocalDateTime(date)).toBe('2024-03-05T07:42');
  });

  it('parses valid datetime-local strings and rejects invalid ones', () => {
    const parsed = parseLocalDateTime('2030-12-01T23:15');
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed?.toISOString()).toBe('2030-12-01T23:15:00.000Z');

    expect(parseLocalDateTime('2030-02-30T23:15')).toBeNull();
    expect(parseLocalDateTime('bad input')).toBeNull();
  });

  it('computes whole-minute durations between instants', () => {
    expect(
      calculateDurationMinutes('2024-01-01T00:00:00Z', '2024-01-01T00:45:30Z'),
    ).toBe(46);
    expect(
      calculateDurationMinutes(new Date('2024-01-01T00:00:00Z'), new Date('2023-12-31T23:59:00Z')),
    ).toBe(0);
  });

  it('returns the end of the current day when computing default deadlines', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-10T09:12:00Z'));

    expect(defaultEndOfToday()).toBe('2024-06-10T23:59');

    vi.useRealTimers();
  });
});
