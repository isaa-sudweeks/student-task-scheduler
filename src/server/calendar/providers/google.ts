import { CalendarProvider } from '@prisma/client';
import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';

import { env } from '@/env';
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

export type GoogleAccountCredentials = {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
};

const PROVIDER = CalendarProvider.GOOGLE;

type OAuthState = {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
};

const createGoogleAuthClient = (account: GoogleAccountCredentials) => {
  const auth = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  let credentialsState: OAuthState = {
    access_token: account.access_token ?? undefined,
    refresh_token: account.refresh_token ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  };
  auth.setCredentials(credentialsState);

  const refreshIfExpired = async () => {
    if (!credentialsState.expiry_date || credentialsState.expiry_date > Date.now()) return;
    if (!credentialsState.refresh_token) {
      throw new Error('Google access token expired and refresh token is missing');
    }
    const { credentials } = await auth.refreshAccessToken();
    credentialsState = {
      access_token: credentials.access_token ?? credentialsState.access_token,
      refresh_token: credentials.refresh_token ?? credentialsState.refresh_token,
      expiry_date: credentials.expiry_date ?? credentialsState.expiry_date,
    };
    auth.setCredentials(credentialsState);
  };

  return { auth, refreshIfExpired };
};

export async function withGoogleClient<T>(
  userId: string,
  handler: (calendar: calendar_v3.Calendar, account: GoogleAccountCredentials) => Promise<T>,
): Promise<{ result?: T; error?: string }>
{
  const account = await db.account.findFirst({
    where: { userId, provider: 'google' },
    select: { access_token: true, refresh_token: true, expires_at: true },
  });
  if (!account?.access_token) {
    return { error: 'Connect your Google account to enable calendar sync.' };
  }
  const credentials: GoogleAccountCredentials = {
    access_token: account.access_token,
    refresh_token: account.refresh_token ?? null,
    expires_at: account.expires_at ?? null,
  };
  const { auth, refreshIfExpired } = createGoogleAuthClient(credentials);
  try {
    await refreshIfExpired();
  } catch (error) {
    console.error('Failed to refresh Google access token', error);
    return { error: 'Unable to refresh Google access token. Please reconnect Google sync.' };
  }
  const calendar = google.calendar({ version: 'v3', auth });
  try {
    const result = await handler(calendar, credentials);
    return { result };
  } catch (error) {
    console.error('Google Calendar API call failed', error);
    return { error: 'Google Calendar API request failed.' };
  }
}

const createEvent = async (args: CalendarProviderEventArgs): Promise<CalendarProviderResult> => {
  const { payload, userId, existingExternalId } = args;
  if (existingExternalId) {
    return updateEvent({
      userId,
      taskId: args.taskId,
      eventId: args.eventId ?? '',
      payload,
      externalId: existingExternalId,
    });
  }
  const { result, error } = await withGoogleClient(userId, async (calendar) => {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: payload.summary,
        description: payload.description ?? undefined,
        location: payload.location ?? undefined,
        start: { dateTime: payload.startAt.toISOString() },
        end: { dateTime: payload.endAt.toISOString() },
      },
    });
    return response.data.id || undefined;
  });
  if (error) {
    return { provider: PROVIDER, status: 'error', message: error };
  }
  return { provider: PROVIDER, status: 'success', externalId: result };
};

const updateEvent = async (args: CalendarProviderUpdateArgs): Promise<CalendarProviderResult> => {
  const { externalId, payload, userId } = args;
  if (!externalId) {
    return createEvent({
      userId,
      taskId: args.taskId,
      eventId: args.eventId,
      payload,
    });
  }
  const { error } = await withGoogleClient(userId, async (calendar) => {
    await calendar.events.update({
      calendarId: 'primary',
      eventId: externalId,
      requestBody: {
        summary: payload.summary,
        description: payload.description ?? undefined,
        location: payload.location ?? undefined,
        start: { dateTime: payload.startAt.toISOString() },
        end: { dateTime: payload.endAt.toISOString() },
      },
    });
    return undefined;
  });
  if (error) {
    return { provider: PROVIDER, status: 'error', message: error, externalId };
  }
  return { provider: PROVIDER, status: 'success', externalId };
};

const deleteEvent = async (args: CalendarProviderDeleteArgs): Promise<CalendarProviderResult> => {
  const { externalId, userId } = args;
  if (!externalId) {
    return { provider: PROVIDER, status: 'skipped' };
  }
  const { error } = await withGoogleClient(userId, async (calendar) => {
    await calendar.events.delete({ calendarId: 'primary', eventId: externalId });
    return undefined;
  });
  if (error) {
    return { provider: PROVIDER, status: 'error', message: error, externalId };
  }
  return { provider: PROVIDER, status: 'success', externalId };
};

const syncFull = async (
  args: CalendarProviderFullSyncArgs,
): Promise<CalendarProviderFullSyncResult> => {
  const { userId } = args;
  const { result, error } = await withGoogleClient(userId, async (calendar) => {
    const items: calendar_v3.Schema$Event[] = [];
    let pageToken: string | undefined;
    do {
      const res = await calendar.events.list({ calendarId: 'primary', maxResults: 2500, pageToken });
      items.push(...(res.data.items ?? []));
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
    return items;
  });

  if (error || !result) {
    return { provider: PROVIDER, status: 'error', message: error ?? 'Unable to sync Google Calendar.' };
  }

  return { provider: PROVIDER, status: 'success', syncedIds: (result ?? []).map((item) => item.id || '').filter(Boolean) };
};

export const googleCalendarAdapter: CalendarProviderAdapter = {
  createEvent,
  updateEvent,
  deleteEvent,
  syncFull,
};
