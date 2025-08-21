import { describe, it, expect } from 'vitest';
import { findNonOverlappingSlot } from './scheduling';

function d(s: string) { return new Date(s); }

describe('findNonOverlappingSlot', () => {
  it('returns the requested slot when no overlaps', () => {
    const events = [
      { startAt: d('2099-01-01T10:00:00Z'), endAt: d('2099-01-01T11:00:00Z') },
    ];
    const result = findNonOverlappingSlot({
      desiredStart: d('2099-01-01T08:00:00Z'),
      durationMinutes: 30,
      dayWindowStartHour: 8,
      dayWindowEndHour: 18,
      existing: events,
      stepMinutes: 15,
    });
    expect(result?.startAt.toISOString()).toBe('2099-01-01T08:00:00.000Z');
    expect(result?.endAt.toISOString()).toBe('2099-01-01T08:30:00.000Z');
  });

  it('shifts forward to next available 15-min slot within day window', () => {
    const events = [
      { startAt: d('2099-01-01T08:00:00Z'), endAt: d('2099-01-01T09:00:00Z') },
    ];
    const result = findNonOverlappingSlot({
      desiredStart: d('2099-01-01T08:30:00Z'),
      durationMinutes: 30,
      dayWindowStartHour: 8,
      dayWindowEndHour: 18,
      existing: events,
      stepMinutes: 15,
    });
    // Next open is 09:00–09:30
    expect(result?.startAt.toISOString()).toBe('2099-01-01T09:00:00.000Z');
    expect(result?.endAt.toISOString()).toBe('2099-01-01T09:30:00.000Z');
  });

  it('honors custom day window bounds', () => {
    const events: any[] = [];
    const ok = findNonOverlappingSlot({
      desiredStart: d('2099-01-01T05:00:00Z'),
      durationMinutes: 60,
      dayWindowStartHour: 5,
      dayWindowEndHour: 7,
      existing: events,
      stepMinutes: 15,
    });
    expect(ok?.startAt.toISOString()).toBe('2099-01-01T05:00:00.000Z');
    expect(ok?.endAt.toISOString()).toBe('2099-01-01T06:00:00.000Z');

    const fail = findNonOverlappingSlot({
      desiredStart: d('2099-01-01T06:30:00Z'),
      durationMinutes: 60,
      dayWindowStartHour: 5,
      dayWindowEndHour: 7,
      existing: events,
      stepMinutes: 15,
    });
    expect(fail).toBeNull();
  });

  it('returns null when no slot available before day end', () => {
    const events = [
      { startAt: d('2099-01-01T08:00:00Z'), endAt: d('2099-01-01T18:00:00Z') },
    ];
    const result = findNonOverlappingSlot({
      desiredStart: d('2099-01-01T08:00:00Z'),
      durationMinutes: 30,
      dayWindowStartHour: 8,
      dayWindowEndHour: 18,
      existing: events,
      stepMinutes: 15,
    });
    expect(result).toBeNull();
  });
});

