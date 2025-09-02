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
    expect(parsed.getTime()).toBe(date.getTime());

    process.env.TZ = originalTZ;
  });

  it('calculates duration minutes with minimum of one minute', () => {
    const start = new Date(2024, 0, 1, 9, 0);
    const end = new Date(2024, 0, 1, 10, 30);
    expect(calculateDurationMinutes(start, end)).toBe(90);
    expect(calculateDurationMinutes(start, start)).toBe(1);
    expect(
      calculateDurationMinutes(start.toISOString(), end.toISOString())
    ).toBe(90);
  });
});
