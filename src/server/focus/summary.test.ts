import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { summarizeFocusIntervals } from './summary';

describe('summarizeFocusIntervals', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-04-05T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns zeros when no work intervals exist', () => {
    const summary = summarizeFocusIntervals([]);
    expect(summary).toEqual({
      currentStreakDays: 0,
      longestStreakDays: 0,
      workIntervalsToday: 0,
      workMinutesLast7Days: 0,
      totalWorkMinutes: 0,
    });
  });

  it('computes streaks and minute totals from mixed intervals', () => {
    const logs = [
      // Longest streak (4 days in March)
      interval('2024-03-10T15:00:00Z', 25),
      interval('2024-03-11T15:00:00Z', 20),
      interval('2024-03-12T15:00:00Z', 30),
      interval('2024-03-13T15:00:00Z', 30),
      // Current streak (3 days ending today)
      interval('2024-04-03T16:00:00Z', 30),
      interval('2024-04-04T16:00:00Z', 25),
      interval('2024-04-04T18:00:00Z', 15),
      interval('2024-04-05T09:00:00Z', 45),
      // Break interval should be ignored
      {
        type: 'BREAK',
        startedAt: new Date('2024-04-05T10:00:00Z'),
        endedAt: new Date('2024-04-05T10:10:00Z'),
      },
    ];

    const summary = summarizeFocusIntervals(logs);

    expect(summary.currentStreakDays).toBe(3);
    expect(summary.longestStreakDays).toBe(4);
    expect(summary.workIntervalsToday).toBe(1);
    // Last 7 days includes work on Apr 3, 4, 5 => 30 + 25 + 15 + 45 = 115 minutes
    expect(summary.workMinutesLast7Days).toBe(115);
    // Total work minutes sums all work entries: 25+20+30+30+30+25+15+45 = 220
    expect(summary.totalWorkMinutes).toBe(220);
  });
});

function interval(startIso: string, minutes: number) {
  const startedAt = new Date(startIso);
  const endedAt = new Date(startedAt.getTime() + minutes * 60000);
  return {
    type: 'WORK',
    startedAt,
    endedAt,
  } as const;
}
