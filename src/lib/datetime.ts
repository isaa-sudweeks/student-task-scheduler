import { format } from 'date-fns';

const DATETIME_LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm";

export function formatLocalDateTime(date: Date): string {
  return format(date, DATETIME_LOCAL_FORMAT);
}

export function parseLocalDateTime(value: string): Date {
  // Expecting 'yyyy-MM-ddTHH:mm' (no timezone); interpret as local time explicitly
  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) return new Date(NaN);
  const [yStr, mStr, dStr] = datePart.split('-');
  const [hhStr, mmStr] = timePart.split(':');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

export function calculateDurationMinutes(startAt: Date | string, endAt: Date | string): number {
  const start = new Date(startAt);
  const end = new Date(endAt);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
}

export function defaultEndOfToday(): string {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return formatLocalDateTime(d);
}
