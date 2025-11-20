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

const PROVIDER = CalendarProvider.MICROSOFT;
const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0/me/events';

type GraphEvent = {
  id?: string;
};

type GraphResult<T> = { result?: T; error?: string };

async function withMicrosoftToken<T>(
  userId: string,
  handler: (accessToken: string) => Promise<T>,
): Promise<GraphResult<T>> {
  const account = await db.account.findFirst({
    where: { userId, provider: 'microsoft' },
    select: { access_token: true },
  });
  if (!account?.access_token) {
    return { error: 'Connect a Microsoft account to sync events.' };
  }
  try {
    const result = await handler(account.access_token);
    return { result };
  } catch (error) {
    console.error('Microsoft Graph request failed', error);
    return { error: 'Microsoft Graph API request failed.' };
  }
}

const toGraphPayload = (args: CalendarProviderEventArgs['payload']) => {
  const body = args.description
    ? {
        contentType: 'TEXT',
        content: args.description,
      }
    : undefined;
  const location = args.location ? { displayName: args.location } : undefined;
  const timezone = args.timezone || 'UTC';
  return {
    subject: args.summary,
    body,
    start: { dateTime: args.startAt.toISOString(), timeZone: timezone },
    end: { dateTime: args.endAt.toISOString(), timeZone: timezone },
    ...(location ? { location } : {}),
  };
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
  const payload = toGraphPayload(args.payload);
  const { result, error } = await withMicrosoftToken(args.userId, async (token) => {
    const response = await fetch(GRAPH_BASE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Graph create failed: ${response.status}`);
    }
    const data = (await response.json()) as GraphEvent;
    return data.id;
  });
  if (error) {
    return { provider: PROVIDER, status: 'error', message: error };
  }
  return { provider: PROVIDER, status: 'success', externalId: result };
};

const updateEvent = async (args: CalendarProviderUpdateArgs): Promise<CalendarProviderResult> => {
  if (!args.externalId) {
    return createEvent({
      userId: args.userId,
      taskId: args.taskId,
      eventId: args.eventId,
      payload: args.payload,
    });
  }
  const payload = toGraphPayload(args.payload);
  const { error } = await withMicrosoftToken(args.userId, async (token) => {
    const response = await fetch(`${GRAPH_BASE_URL}/${args.externalId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Graph update failed: ${response.status}`);
    }
    return undefined;
  });
  if (error) {
    return { provider: PROVIDER, status: 'error', message: error, externalId: args.externalId };
  }
  return { provider: PROVIDER, status: 'success', externalId: args.externalId };
};

const deleteEvent = async (args: CalendarProviderDeleteArgs): Promise<CalendarProviderResult> => {
  if (!args.externalId) {
    return { provider: PROVIDER, status: 'skipped' };
  }
  const { error } = await withMicrosoftToken(args.userId, async (token) => {
    const response = await fetch(`${GRAPH_BASE_URL}/${args.externalId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Graph delete failed: ${response.status}`);
    }
    return undefined;
  });
  if (error) {
    return { provider: PROVIDER, status: 'error', message: error, externalId: args.externalId };
  }
  return { provider: PROVIDER, status: 'success', externalId: args.externalId };
};

const syncFull = async (
  args: CalendarProviderFullSyncArgs,
): Promise<CalendarProviderFullSyncResult> => {
  const { result, error } = await withMicrosoftToken(args.userId, async (token) => {
    const response = await fetch(`${GRAPH_BASE_URL}?$top=2500`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Graph sync failed: ${response.status}`);
    }
    const data = (await response.json()) as { value?: GraphEvent[] };
    return data.value ?? [];
  });
  if (error || !result) {
    return { provider: PROVIDER, status: 'error', message: error ?? 'Unable to sync Microsoft calendars.' };
  }
  return {
    provider: PROVIDER,
    status: 'success',
    syncedIds: result.map((event) => event.id || '').filter(Boolean),
  };
};

export const microsoftCalendarAdapter: CalendarProviderAdapter = {
  createEvent,
  updateEvent,
  deleteEvent,
  syncFull,
};
