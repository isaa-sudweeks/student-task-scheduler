import { CalendarProvider } from '@prisma/client';

import { db } from '@/server/db';

import type {
  CalendarProviderAdapter,
  CalendarProviderDeleteArgs,
  CalendarProviderEventArgs,
  CalendarProviderFullSyncArgs,
  CalendarProviderFullSyncResult,
  CalendarProviderResult,
  CalendarProviderUpdateArgs,
} from '../types';

const PROVIDER = CalendarProvider.APPLE;
const CALDAV_BASE_URL = 'https://caldav.icloud.com';

type CalDavResult<T> = { result?: T; error?: string };

type CalDavContext = { baseUrl: string; authHeader: string };

async function withAppleCalDav<T>(userId: string, handler: (context: CalDavContext) => Promise<T>): Promise<CalDavResult<T>> {
  const account = await db.account.findFirst({
    where: { userId, provider: 'apple' },
    select: { access_token: true, providerAccountId: true },
  });
  if (!account?.access_token || !account.providerAccountId) {
    return { error: 'Connect your Apple account to sync via CalDAV.' };
  }
  const authHeader = `Basic ${Buffer.from(`${account.providerAccountId}:${account.access_token}`).toString('base64')}`;
  const baseUrl = `${CALDAV_BASE_URL}/${account.providerAccountId}/calendars/default/`;
  try {
    const result = await handler({ baseUrl, authHeader });
    return { result };
  } catch (error) {
    console.error('Apple CalDAV request failed', error);
    return { error: 'Apple CalDAV request failed.' };
  }
}

const formatDate = (date: Date) => {
  const pad = (n: number) => `${n}`.padStart(2, '0');
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
};

const buildIcs = (args: CalendarProviderEventArgs) => {
  const uid = args.existingExternalId ?? args.eventId ?? `${Date.now()}-${Math.random()}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//student-task-scheduler//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(args.payload.startAt)}`,
    `DTEND:${formatDate(args.payload.endAt)}`,
    `SUMMARY:${args.payload.summary}`,
  ];
  if (args.payload.location) {
    lines.push(`LOCATION:${args.payload.location}`);
  }
  if (args.payload.description) {
    const escaped = args.payload.description.replace(/\\/g, '\\\\').replace(/,|;/g, (match) => `\\${match}`).replace(/\r?\n/g, '\\n');
    lines.push(`DESCRIPTION:${escaped}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return { uid, body: lines.join('\r\n') };
};

const createEvent = async (args: CalendarProviderEventArgs): Promise<CalendarProviderResult> => {
  if (args.existingExternalId) {
    return updateEvent({
      userId: args.userId,
      taskId: args.taskId,
      eventId: args.eventId ?? '',
      payload: args.payload,
      externalId: args.existingExternalId,
    });
  }
  const { uid, body } = buildIcs(args);
  const { error } = await withAppleCalDav(args.userId, async ({ baseUrl, authHeader }) => {
    const response = await fetch(`${baseUrl}${uid}.ics`, {
      method: 'PUT',
      headers: { Authorization: authHeader, 'Content-Type': 'text/calendar; charset=utf-8' },
      body,
    });
    if (!response.ok) {
      throw new Error(`CalDAV create failed: ${response.status}`);
    }
    return undefined;
  });
  if (error) {
    return { provider: PROVIDER, status: 'error', message: error };
  }
  return { provider: PROVIDER, status: 'success', externalId: uid };
};

const updateEvent = async (args: CalendarProviderUpdateArgs): Promise<CalendarProviderResult> => {
  const externalId = args.externalId ?? args.eventId;
  if (!externalId) {
    return createEvent({
      userId: args.userId,
      taskId: args.taskId,
      eventId: args.eventId,
      payload: args.payload,
    });
  }
  const { body } = buildIcs({ ...args, existingExternalId: externalId });
  const { error } = await withAppleCalDav(args.userId, async ({ baseUrl, authHeader }) => {
    const response = await fetch(`${baseUrl}${externalId}.ics`, {
      method: 'PUT',
      headers: { Authorization: authHeader, 'Content-Type': 'text/calendar; charset=utf-8' },
      body,
    });
    if (!response.ok) {
      throw new Error(`CalDAV update failed: ${response.status}`);
    }
    return undefined;
  });
  if (error) {
    return { provider: PROVIDER, status: 'error', message: error, externalId };
  }
  return { provider: PROVIDER, status: 'success', externalId };
};

const deleteEvent = async (args: CalendarProviderDeleteArgs): Promise<CalendarProviderResult> => {
  const externalId = args.externalId ?? args.eventId;
  if (!externalId) {
    return { provider: PROVIDER, status: 'skipped' };
  }
  const { error } = await withAppleCalDav(args.userId, async ({ baseUrl, authHeader }) => {
    const response = await fetch(`${baseUrl}${externalId}.ics`, {
      method: 'DELETE',
      headers: { Authorization: authHeader },
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`CalDAV delete failed: ${response.status}`);
    }
    return undefined;
  });
  if (error) {
    return { provider: PROVIDER, status: 'error', message: error, externalId };
  }
  return { provider: PROVIDER, status: 'success', externalId };
};

const syncFull = async (
  _args: CalendarProviderFullSyncArgs,
): Promise<CalendarProviderFullSyncResult> => ({
  provider: PROVIDER,
  status: 'skipped',
  message: 'Apple Calendar sync runs incrementally via CalDAV; manual sync is not required.',
});

export const appleCalendarAdapter: CalendarProviderAdapter = {
  createEvent,
  updateEvent,
  deleteEvent,
  syncFull,
};
