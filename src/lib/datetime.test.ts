import { describe, it, expect } from 'vitest';
import { formatLocalDateTime, parseLocalDateTime } from './datetime';

describe('datetime utility', () => {
  it('round trips preserving local timezone', () => {
    const originalTZ = process.env.TZ;
    process.env.TZ = 'America/New_York';

    const date = new Date(2024, 0, 1, 12, 30);
    const formatted = formatLocalDateTime(date);
    expect(formatted).toBe('2024-01-01T12:30');
    expect(formatted).not.toBe(date.toISOString().slice(0, 16));

    const parsed = parseLocalDateTime(formatted);
    expect(parsed.getTime()).toBe(date.getTime());

    process.env.TZ = originalTZ;
  });
});
