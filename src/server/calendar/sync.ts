import { CalendarProvider, type Prisma } from '@prisma/client';

import { getCalendarProviderAdapter } from './providers';
import type {
  CalendarEventPayload,
  CalendarProviderMap,
  CalendarProviderResult,
} from './types';

export type ProviderExternalRefs = CalendarProviderMap<string>;

const PROVIDER_VALUES = Object.values(CalendarProvider) as CalendarProvider[];

export const parseExternalRefs = (value: Prisma.JsonValue | null | undefined): ProviderExternalRefs => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const map: ProviderExternalRefs = {};
  for (const provider of PROVIDER_VALUES) {
    const key = provider as keyof typeof value;
    const raw = (value as Record<string, unknown>)[key as string];
    if (typeof raw === 'string' && raw.length > 0) {
      map[provider] = raw;
    }
  }
  return map;
};

export const serializeExternalRefs = (refs: ProviderExternalRefs): Prisma.JsonValue => ({ ...refs });

const dedupeProviders = (providers: CalendarProvider[]): CalendarProvider[] =>
  Array.from(new Set(providers));

export const resolveProvidersForUser = (
  providers: CalendarProvider[] | null | undefined,
  googleEnabled: boolean,
): CalendarProvider[] => {
  const next = new Set<CalendarProvider>(providers ?? []);
  if (googleEnabled) {
    next.add(CalendarProvider.GOOGLE);
  }
  return dedupeProviders(Array.from(next));
};

const collectWarning = (result: CalendarProviderResult): string | undefined => {
  if (result.status === 'error') {
    return result.message ?? `${result.provider} calendar sync failed.`;
  }
  if (result.status === 'skipped' && result.message) {
    return result.message;
  }
  return undefined;
};

type SyncBaseArgs = {
  userId: string;
  taskId: string;
  providers: CalendarProvider[];
  payload: CalendarEventPayload;
  eventId?: string;
  existingRefs?: ProviderExternalRefs;
};

export type SyncOperationOutcome = {
  results: CalendarProviderResult[];
  warnings: string[];
  refs: ProviderExternalRefs;
};

export const syncEventCreate = async (args: SyncBaseArgs): Promise<SyncOperationOutcome> => {
  const refs: ProviderExternalRefs = { ...(args.existingRefs ?? {}) };
  const warnings: string[] = [];
  const results: CalendarProviderResult[] = [];
  const providers = dedupeProviders(args.providers);

  for (const provider of providers) {
    const adapter = getCalendarProviderAdapter(provider);
    if (!adapter) {
      warnings.push(`${provider} calendar adapter is not configured.`);
      continue;
    }
    const result = await adapter.createEvent({
      userId: args.userId,
      taskId: args.taskId,
      eventId: args.eventId,
      payload: args.payload,
      existingExternalId: refs[provider],
    });
    results.push(result);
    if (result.status === 'success' && result.externalId) {
      refs[provider] = result.externalId;
    }
    const warning = collectWarning(result);
    if (warning) warnings.push(warning);
  }

  return { results, warnings, refs };
};

type SyncUpdateArgs = SyncBaseArgs & { eventId: string };

export const syncEventUpdate = async (args: SyncUpdateArgs): Promise<SyncOperationOutcome> => {
  const refs: ProviderExternalRefs = { ...(args.existingRefs ?? {}) };
  const warnings: string[] = [];
  const results: CalendarProviderResult[] = [];
  const providers = dedupeProviders(args.providers);

  for (const provider of providers) {
    const adapter = getCalendarProviderAdapter(provider);
    if (!adapter) {
      warnings.push(`${provider} calendar adapter is not configured.`);
      continue;
    }
    const result = await adapter.updateEvent({
      userId: args.userId,
      taskId: args.taskId,
      eventId: args.eventId,
      payload: args.payload,
      externalId: refs[provider],
    });
    results.push(result);
    if (result.status === 'success' && result.externalId) {
      refs[provider] = result.externalId;
    }
    const warning = collectWarning(result);
    if (warning) warnings.push(warning);
  }

  return { results, warnings, refs };
};

type SyncDeleteArgs = {
  userId: string;
  taskId: string;
  eventId: string;
  providers: CalendarProvider[];
  refs: ProviderExternalRefs;
};

export const syncEventDelete = async (args: SyncDeleteArgs): Promise<SyncOperationOutcome> => {
  const refs: ProviderExternalRefs = { ...args.refs };
  const warnings: string[] = [];
  const results: CalendarProviderResult[] = [];
  const providers = dedupeProviders(args.providers);

  for (const provider of providers) {
    const adapter = getCalendarProviderAdapter(provider);
    if (!adapter) {
      warnings.push(`${provider} calendar adapter is not configured.`);
      continue;
    }
    const result = await adapter.deleteEvent({
      userId: args.userId,
      taskId: args.taskId,
      eventId: args.eventId,
      externalId: refs[provider],
    });
    results.push(result);
    if (result.status === 'success' || result.status === 'skipped') {
      delete refs[provider];
    }
    const warning = collectWarning(result);
    if (warning) warnings.push(warning);
  }

  return { results, warnings, refs };
};
