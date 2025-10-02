import { Interval } from '@/lib/scheduling';

export type TimezoneConverter = {
  toZoned: (instant: Date) => Date;
  toUtc: (instant: Date) => Date;
  intervalToZoned: (interval: Interval) => Interval;
  intervalToUtc: (interval: Interval) => Interval;
};

const IDENTITY_CONVERTER: TimezoneConverter = {
  toZoned: (instant) => new Date(instant),
  toUtc: (instant) => new Date(instant),
  intervalToZoned: (interval) => ({
    startAt: new Date(interval.startAt),
    endAt: new Date(interval.endAt),
  }),
  intervalToUtc: (interval) => ({
    startAt: new Date(interval.startAt),
    endAt: new Date(interval.endAt),
  }),
};

export function createTimezoneConverter(timezone: string | null | undefined): TimezoneConverter {
  if (!timezone) return IDENTITY_CONVERTER;

  return {
    toZoned: (instant) => convertToTimezone(instant, timezone),
    toUtc: (instant) => convertFromTimezoneToUtc(instant, timezone),
    intervalToZoned: (interval) => ({
      startAt: convertToTimezone(interval.startAt, timezone),
      endAt: convertToTimezone(interval.endAt, timezone),
    }),
    intervalToUtc: (interval) => ({
      startAt: convertFromTimezoneToUtc(interval.startAt, timezone),
      endAt: convertFromTimezoneToUtc(interval.endAt, timezone),
    }),
  };
}

function convertToTimezone(instant: Date, timezone: string): Date {
  const offsetMs = getOffsetMs(instant, timezone);
  return new Date(instant.getTime() - offsetMs);
}

function convertFromTimezoneToUtc(instant: Date, timezone: string): Date {
  let utc = new Date(instant);
  for (let i = 0; i < 5; i++) {
    const offset = getOffsetMs(utc, timezone);
    const candidate = new Date(instant.getTime() + offset);
    if (Math.abs(candidate.getTime() - utc.getTime()) < 1) return candidate;
    utc = candidate;
  }
  return utc;
}

function getOffsetMs(instant: Date, timezone: string): number {
  try {
    const localized = instant.toLocaleString('en-US', { timeZone: timezone });
    const localDate = new Date(localized);
    return instant.getTime() - localDate.getTime();
  } catch {
    return 0;
  }
}
