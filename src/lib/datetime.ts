import { format, parse } from 'date-fns';

const DATETIME_LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm";

export function formatLocalDateTime(date: Date): string {
  return format(date, DATETIME_LOCAL_FORMAT);
}

export function parseLocalDateTime(value: string): Date {
  return parse(value, DATETIME_LOCAL_FORMAT, new Date(0));
}

export function defaultEndOfToday(): string {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return formatLocalDateTime(d);
}
