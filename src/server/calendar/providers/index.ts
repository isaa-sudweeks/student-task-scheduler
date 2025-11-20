import { CalendarProvider } from '@prisma/client';

import { appleCalendarAdapter } from './apple';
import { googleCalendarAdapter } from './google';
import { microsoftCalendarAdapter } from './microsoft';
import type { CalendarProviderAdapter } from '../types';

export const calendarProviderRegistry: Record<CalendarProvider, CalendarProviderAdapter> = {
  [CalendarProvider.GOOGLE]: googleCalendarAdapter,
  [CalendarProvider.MICROSOFT]: microsoftCalendarAdapter,
  [CalendarProvider.APPLE]: appleCalendarAdapter,
};

export const getCalendarProviderAdapter = (provider: CalendarProvider): CalendarProviderAdapter | undefined =>
  calendarProviderRegistry[provider];
