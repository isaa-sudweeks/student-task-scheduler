import type { CalendarProvider } from '@prisma/client';

export type CalendarProviderMap<T> = Partial<Record<CalendarProvider, T>>;

export type CalendarEventPayload = {
  summary: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  description?: string | null;
  location?: string | null;
};

export type CalendarProviderStatus = 'success' | 'skipped' | 'error';

export type CalendarProviderResult = {
  provider: CalendarProvider;
  status: CalendarProviderStatus;
  externalId?: string;
  message?: string;
};

export interface CalendarProviderEventArgs {
  userId: string;
  taskId: string;
  eventId?: string;
  payload: CalendarEventPayload;
  existingExternalId?: string;
}

export interface CalendarProviderUpdateArgs {
  userId: string;
  taskId: string;
  eventId: string;
  payload: CalendarEventPayload;
  externalId?: string;
}

export interface CalendarProviderDeleteArgs {
  userId: string;
  taskId: string;
  eventId: string;
  externalId?: string;
}

export interface CalendarProviderFullSyncArgs {
  userId: string;
  timezone: string;
}

export type CalendarProviderFullSyncResult = CalendarProviderResult & {
  syncedIds?: string[];
};

export interface CalendarProviderAdapter {
  createEvent(args: CalendarProviderEventArgs): Promise<CalendarProviderResult>;
  updateEvent(args: CalendarProviderUpdateArgs): Promise<CalendarProviderResult>;
  deleteEvent(args: CalendarProviderDeleteArgs): Promise<CalendarProviderResult>;
  syncFull?(args: CalendarProviderFullSyncArgs): Promise<CalendarProviderFullSyncResult>;
}
