import { describe, expect, it } from 'vitest';
import { findNonOverlappingSlot, Interval } from '@/lib/scheduling';

describe('findNonOverlappingSlot', () => {
  const baseDay = new Date('2024-04-01T09:00:00Z');

  it('returns the requested slot when the day is empty', () => {
    const slot = findNonOverlappingSlot({
      desiredStart: baseDay,
      durationMinutes: 60,
      dayWindowStartHour: 8,
      dayWindowEndHour: 18,
      existing: [],
    });
    expect(slot).not.toBeNull();
    expect(slot?.startAt.toISOString()).toBe('2024-04-01T09:00:00.000Z');
    expect(slot?.endAt.toISOString()).toBe('2024-04-01T10:00:00.000Z');
  });

  it('skips over overlapping intervals and rounds to the configured step', () => {
    const existing: Interval[] = [
      { startAt: new Date('2024-04-01T08:30:00Z'), endAt: new Date('2024-04-01T09:30:00Z') },
      { startAt: new Date('2024-04-01T10:00:00Z'), endAt: new Date('2024-04-01T11:00:00Z') },
    ];
    const slot = findNonOverlappingSlot({
      desiredStart: baseDay,
      durationMinutes: 30,
      dayWindowStartHour: 8,
      dayWindowEndHour: 18,
      existing,
      stepMinutes: 15,
    });
    expect(slot).not.toBeNull();
    expect(slot?.startAt.toISOString()).toBe('2024-04-01T09:30:00.000Z');
    expect(slot?.endAt.toISOString()).toBe('2024-04-01T10:00:00.000Z');
  });

  it('returns null when no slot fits within the window', () => {
    const existing: Interval[] = [
      { startAt: new Date('2024-04-01T08:00:00Z'), endAt: new Date('2024-04-01T17:30:00Z') },
    ];
    const slot = findNonOverlappingSlot({
      desiredStart: baseDay,
      durationMinutes: 90,
      dayWindowStartHour: 8,
      dayWindowEndHour: 18,
      existing,
    });
    expect(slot).toBeNull();
  });
});
