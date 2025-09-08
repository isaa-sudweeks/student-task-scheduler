import { format } from 'date-fns';

const DATETIME_LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm";

export function formatLocalDateTime(date: Date): string {
  return format(date, DATETIME_LOCAL_FORMAT);
}

export function parseLocalDateTime(value: string): Date | null {
  // Expecting 'yyyy-MM-ddTHH:mm' (no timezone); interpret as local time explicitly
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, yStr, mStr, dStr, hhStr, mmStr] = match;
  const y = Number(yStr);
  const m = Number(mStr) - 1; // JS months are 0-indexed
  const d = Number(dStr);
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  const date = new Date(y, m, d, hh, mm, 0, 0);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m ||
    date.getDate() !== d ||
    date.getHours() !== hh ||
    date.getMinutes() !== mm
  ) {
    return null;
  }
  return date;
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
