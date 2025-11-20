import { differenceInCalendarDays, startOfDay, subDays } from 'date-fns';

export interface FocusIntervalLike {
  startedAt: Date;
  endedAt: Date;
  type: FocusIntervalTypeValue;
}

export type FocusIntervalTypeValue = 'WORK' | 'BREAK';

export interface FocusSummary {
  currentStreakDays: number;
  longestStreakDays: number;
  workIntervalsToday: number;
  workMinutesLast7Days: number;
  totalWorkMinutes: number;
}

export function summarizeFocusIntervals(logs: FocusIntervalLike[]): FocusSummary {
  if (logs.length === 0) {
    return {
      currentStreakDays: 0,
      longestStreakDays: 0,
      workIntervalsToday: 0,
      workMinutesLast7Days: 0,
      totalWorkMinutes: 0,
    };
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const sevenDaysAgo = startOfDay(subDays(now, 6));

  let totalWorkMinutes = 0;
  let workMinutesLast7Days = 0;
  let workIntervalsToday = 0;

  const dayKey = (date: Date) => startOfDay(date).getTime();
  const uniqueDays = new Set<number>();

  for (const log of logs) {
    if (log.type !== 'WORK') continue;
    const durationMinutes = Math.max(0, (log.endedAt.getTime() - log.startedAt.getTime()) / 60000);
    totalWorkMinutes += durationMinutes;

    const startedDay = startOfDay(log.startedAt);
    uniqueDays.add(dayKey(startedDay));

    if (startedDay.getTime() >= sevenDaysAgo.getTime()) {
      workMinutesLast7Days += durationMinutes;
    }

    if (startedDay.getTime() === todayStart.getTime()) {
      workIntervalsToday += 1;
    }
  }

  const sortedDays = Array.from(uniqueDays.values()).sort((a, b) => a - b);
  let currentStreakDays = 0;
  let longestStreakDays = 0;

  // Compute current streak ending today
  let expectedDay = todayStart.getTime();
  for (let i = sortedDays.length - 1; i >= 0; i -= 1) {
    const day = sortedDays[i];
    if (day === expectedDay) {
      currentStreakDays += 1;
      expectedDay = startOfDay(subDays(new Date(expectedDay), 1)).getTime();
    } else if (day < expectedDay) {
      break;
    }
  }

  // Compute longest streak anywhere in the history
  let streakSoFar = 0;
  let lastDay: number | null = null;
  for (const day of sortedDays) {
    if (lastDay == null) {
      streakSoFar = 1;
    } else {
      const distance = differenceInCalendarDays(new Date(day), new Date(lastDay));
      if (distance === 0) {
        // Same day, ignore for streak calculations
      } else if (distance === 1) {
        streakSoFar += 1;
      } else {
        streakSoFar = 1;
      }
    }
    lastDay = day;
    if (streakSoFar > longestStreakDays) {
      longestStreakDays = streakSoFar;
    }
  }

  return {
    currentStreakDays,
    longestStreakDays,
    workIntervalsToday,
    workMinutesLast7Days: Math.round(workMinutesLast7Days),
    totalWorkMinutes: Math.round(totalWorkMinutes),
  };
}
