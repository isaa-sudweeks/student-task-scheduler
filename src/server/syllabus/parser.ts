import { logger } from '@/server/logger';

export interface ParsedAssignment {
  title: string;
  dueAt: Date | null;
  notes?: string | null;
  sourceLine?: string;
}

export interface ParseOptions {
  now?: Date;
  maxAssignments?: number;
  defaultDueHour?: number;
}

const MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sept: 8,
  sep: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

const DEFAULT_MAX_ASSIGNMENTS = 50;
const DEFAULT_DUE_HOUR = 17;

const monthNamePattern =
  /\b(?<month>jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\.,]?\s+(?<day>\d{1,2})(?:,?\s*(?<year>\d{2,4}))?/i;
const numericDatePattern = /\b(?<month>\d{1,2})[\/\-](?<day>\d{1,2})(?:[\/\-](?<year>\d{2,4}))?/;
const timePattern = /\b(?<hour>\d{1,2})(?::(?<minute>\d{2}))?\s*(?<meridiem>am|pm)\b|\b(?<hour24>\d{1,2}):(?<minute24>\d{2})\b/i;

const cleanTitle = (raw: string): string => {
  let title = raw
    .replace(/\b(?:due|by|deadline)\b:?/gi, '')
    .replace(/[–—-]{2,}/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  title = title.replace(/^[\-–—:,]+/, '').trim();
  title = title.replace(/^(?:on|at)\s+/i, '').trim();
  title = title.replace(/\bat\s*$/i, '').trim();
  if (title.endsWith(':')) title = title.slice(0, -1).trim();
  return title;
};

const resolveYear = (monthIndex: number, explicitYear: number | null, now: Date): number => {
  if (explicitYear !== null) {
    return explicitYear < 100 ? 2000 + explicitYear : explicitYear;
  }

  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const diff = monthIndex - currentMonth;
  if (diff < -2) return currentYear + 1;
  return currentYear;
};

const parseLine = (
  line: string,
  options: Required<Pick<ParseOptions, 'now' | 'defaultDueHour'>>,
): ParsedAssignment | null => {
  const normalized = line.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  const monthMatch = normalized.match(monthNamePattern);
  const numericMatch = normalized.match(numericDatePattern);
  const match = monthMatch ?? numericMatch;
  if (!match || !match.groups) return null;

  let monthIndex: number | undefined;
  let day: number | undefined;
  let year: number | null = null;

  if (monthMatch && monthMatch.groups) {
    monthIndex = MONTHS[monthMatch.groups.month!.toLowerCase()];
    day = Number(monthMatch.groups.day);
    year = monthMatch.groups.year ? Number(monthMatch.groups.year) : null;
  } else if (numericMatch && numericMatch.groups) {
    monthIndex = Number(numericMatch.groups.month) - 1;
    day = Number(numericMatch.groups.day);
    year = numericMatch.groups.year ? Number(numericMatch.groups.year) : null;
  }

  if (monthIndex === undefined || Number.isNaN(monthIndex) || !day || day > 31) {
    return null;
  }

  const resolvedYear = resolveYear(monthIndex, year, options.now);

  const timeMatch = normalized.match(timePattern);

  let hours = options.defaultDueHour;
  let minutes = 0;

  if (timeMatch && timeMatch.groups) {
    if (timeMatch.groups.hour) {
      let hour = Number(timeMatch.groups.hour);
      const minute = timeMatch.groups.minute ? Number(timeMatch.groups.minute) : 0;
      const meridiem = timeMatch.groups.meridiem?.toLowerCase();
      if (meridiem === 'pm' && hour < 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;
      hours = hour;
      minutes = minute;
    } else if (timeMatch.groups.hour24) {
      hours = Number(timeMatch.groups.hour24);
      minutes = Number(timeMatch.groups.minute24 ?? 0);
    }
  }

  const dueAt = new Date(Date.UTC(resolvedYear, monthIndex, day, hours, minutes));

  let remainder = normalized;
  remainder = remainder.replace(match[0], ' ');
  if (timeMatch) remainder = remainder.replace(timeMatch[0], ' ');
  const title = cleanTitle(remainder);
  if (!title) return null;

  return {
    title,
    dueAt,
    notes: null,
    sourceLine: normalized,
  };
};

export function parseAssignmentsFromText(text: string, options: ParseOptions = {}): ParsedAssignment[] {
  if (!text || !text.trim()) return [];

  const now = options.now ?? new Date();
  const defaultDueHour = options.defaultDueHour ?? DEFAULT_DUE_HOUR;
  const limit = options.maxAssignments ?? DEFAULT_MAX_ASSIGNMENTS;

  const suggestions: ParsedAssignment[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    if (suggestions.length >= limit) break;
    const parsed = parseLine(rawLine, { now, defaultDueHour });
    if (!parsed) continue;

    const key = `${parsed.title.toLowerCase()}|${parsed.dueAt?.toISOString() ?? 'none'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push(parsed);
  }

  return suggestions;
}

export async function extractAssignmentsFromPdf(
  buffer: Buffer,
  options: ParseOptions = {},
): Promise<ParsedAssignment[]> {
  try {
    const { default: pdfParse } = await import('pdf-parse');
    const result = await pdfParse(buffer);
    const text = typeof result.text === 'string' ? result.text : '';
    return parseAssignmentsFromText(text, options);
  } catch (error) {
    logger.error('Failed to parse syllabus PDF', error instanceof Error ? error : { error });
    return [];
  }
}
