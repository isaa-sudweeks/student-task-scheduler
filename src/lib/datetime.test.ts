import { describe, it, expect } from 'vitest';
import { formatLocalDateTime, parseLocalDateTime, calculateDurationMinutes } from './datetime';

describe('datetime utility', () => {
  it('round trips preserving local timezone', () => {
    const originalTZ = process.env.TZ;
    process.env.TZ = 'America/New_York';

    const date = new Date(2024, 0, 1, 12, 30);
    const formatted = formatLocalDateTime(date);
    expect(formatted).toBe('2024-01-01T12:30');
    const isoSlice = date.toISOString().slice(0, 16);
    if (isoSlice !== formatted) {
      expect(formatted).not.toBe(isoSlice);
    }

    const parsed = parseLocalDateTime(formatted);
    expect(parsed).not.toBeNull();
    expect(parsed?.getTime()).toBe(date.getTime());

    process.env.TZ = originalTZ;
  });

  it('calculates duration minutes', () => {
    const start = new Date(2024, 0, 1, 9, 0);
    const end = new Date(2024, 0, 1, 10, 30);
    expect(calculateDurationMinutes(start, end)).toBe(90);
    expect(calculateDurationMinutes(start, start)).toBe(0);
    expect(
      calculateDurationMinutes(start.toISOString(), end.toISOString())
    ).toBe(90);
  });

  it('returns null for malformed input', () => {
    const cases = [
      '',
      'not-a-date',
      '2024-13-01T00:00',
      '2024-01-32T00:00',
      '2024-01-01T24:00',
      '2024-01-01T00:60',
      '2024/01/01T00:00',
    ];
    for (const c of cases) {
      expect(parseLocalDateTime(c)).toBeNull();
    }
  });

  it('handles leap years and invalid dates', () => {
    const leap = parseLocalDateTime('2024-02-29T12:00');
    expect(leap).not.toBeNull();
    expect(leap?.getFullYear()).toBe(2024);
    expect(leap?.getMonth()).toBe(1);
    expect(leap?.getDate()).toBe(29);

    const nonLeap = parseLocalDateTime('2023-02-29T12:00');
    expect(nonLeap).toBeNull();

    const invalidDate = parseLocalDateTime('2024-02-30T12:00');
    expect(invalidDate).toBeNull();
  });
});
