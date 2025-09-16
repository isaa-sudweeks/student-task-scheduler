import { format, parse, isValid } from 'date-fns';

const DATETIME_LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm";

export function formatLocalDateTime(date: Date): string {
  return format(date, DATETIME_LOCAL_FORMAT);
}

export function parseLocalDateTime(value: string): Date | null {
  // Expecting 'yyyy-MM-ddTHH:mm' (no timezone); interpret as local time explicitly
  const parsed = parse(value, DATETIME_LOCAL_FORMAT, new Date());
  if (!isValid(parsed)) return null;
  if (format(parsed, DATETIME_LOCAL_FORMAT) !== value) return null;
  return parsed;
}

export function calculateDurationMinutes(startAt: Date | string, endAt: Date | string): number {
  const start = new Date(startAt);
  const end = new Date(endAt);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export function defaultEndOfToday(): string {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return formatLocalDateTime(d);
}
