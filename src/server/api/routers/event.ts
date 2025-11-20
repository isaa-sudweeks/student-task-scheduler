import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { calendar_v3 } from 'googleapis';
import type { Event as EventModel, Prisma } from '@prisma/client';
import { CalendarProvider } from '@prisma/client';

import { findNonOverlappingSlot, Interval } from '@/lib/scheduling';
import { createTimezoneConverter } from '@/server/ai/timezone';
import {
  parseExternalRefs,
  resolveProvidersForUser,
  serializeExternalRefs,
  syncEventCreate,
  syncEventDelete,
  syncEventUpdate,
} from '@/server/calendar/sync';
import { withGoogleClient } from '@/server/calendar/providers/google';
import { db } from '@/server/db';
import { protectedProcedure, router } from '../trpc';
import { meetingsToIntervalsForDate } from '@/server/utils/courseMeetings';


export const eventRouter = router({
  listRange: protectedProcedure
    .input(z.object({ start: z.date().optional(), end: z.date().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const where: Prisma.EventWhereInput = { task: { userId } };
      if (input?.start && input?.end) {
        where.AND = [
          { startAt: { lt: input.end } },
          { endAt: { gt: input.start } },
        ];
      }
      return db.event.findMany({ where });
    }),
  schedule: protectedProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        startAt: z.date(),
        durationMinutes: z.number().int().positive(),
        dayWindowStartHour: z.number().int().min(0).max(23).default(8),
        dayWindowEndHour: z.number().int().min(0).max(23).default(18),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { durationMinutes: duration, startAt: desiredStart, dayWindowStartHour, dayWindowEndHour } = input;
      const userId = ctx.session?.user?.id;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const [task, user] = await Promise.all([
        db.task.findFirst({
          where: { id: input.taskId, userId },
          select: { id: true, title: true, course: { select: { meetings: true } } },
        }),
        db.user.findUnique({
          where: { id: userId },
          select: { timezone: true, googleSyncEnabled: true, calendarSyncProviders: true },
        }),
      ]);
      if (!task) throw new TRPCError({ code: 'NOT_FOUND' });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });

      const timezoneConverter = createTimezoneConverter(user.timezone);
      const desiredStartLocal = timezoneConverter.toZoned(desiredStart);
      const sameDayStartLocal = new Date(desiredStartLocal);
      sameDayStartLocal.setHours(0, 0, 0, 0);
      const sameDayEndLocal = new Date(desiredStartLocal);
      sameDayEndLocal.setHours(23, 59, 59, 999);
      const sameDayStart = timezoneConverter.toUtc(sameDayStartLocal);
      const sameDayEnd = timezoneConverter.toUtc(sameDayEndLocal);

      const existing: EventModel[] = await db.event.findMany({
        where: {
          task: { userId },
          // Consider events overlapping the day for overlap avoidance
          AND: { startAt: { lt: sameDayEnd }, endAt: { gt: sameDayStart } },
        },
      });

      const intervals: Interval[] = existing.map((e) =>
        timezoneConverter.intervalToZoned({ startAt: new Date(e.startAt), endAt: new Date(e.endAt) })
      );
      const meetingIntervals = meetingsToIntervalsForDate(task.course?.meetings ?? [], desiredStartLocal);
      const blockingIntervals = intervals.concat(meetingIntervals);

      const slotLocal = findNonOverlappingSlot({
        desiredStart: desiredStartLocal,
        durationMinutes: duration,
        dayWindowStartHour,
        dayWindowEndHour,
        existing: blockingIntervals,
        stepMinutes: 15,
      });

      if (!slotLocal) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'No available time slot without overlapping events or class meetings',
        });
      }

      const slot = timezoneConverter.intervalToUtc(slotLocal);

      const providers = resolveProvidersForUser(user.calendarSyncProviders, user.googleSyncEnabled);
      const baseEvent = await db.event.create({
        data: {
          taskId: input.taskId,
          startAt: slot.startAt,
          endAt: slot.endAt,
          googleEventId: null,
          externalSyncRefs: serializeExternalRefs({}),
        },
      });

      const syncPayload = {
        summary: task.title,
        startAt: slot.startAt,
        endAt: slot.endAt,
        timezone: user.timezone,
      };
      const syncOutcome = await syncEventCreate({
        userId,
        taskId: input.taskId,
        eventId: baseEvent.id,
        providers,
        payload: syncPayload,
        existingRefs: {},
      });

      const updatedEvent = await db.event.update({
        where: { id: baseEvent.id },
        data: {
          googleEventId: syncOutcome.refs[CalendarProvider.GOOGLE] ?? null,
          externalSyncRefs: serializeExternalRefs(syncOutcome.refs),
        },
      });

      return { event: updatedEvent, syncWarnings: syncOutcome.warnings };
    }),
  move: protectedProcedure
    .input(
      z.object({
        eventId: z.string().min(1),
        startAt: z.date(),
        endAt: z.date(),
        dayWindowStartHour: z.number().int().min(0).max(23).default(8),
        dayWindowEndHour: z.number().int().min(0).max(23).default(18),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.endAt <= input.startAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'End must be after start' });
      }

      const userId = ctx.session?.user?.id;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const [existingEvent, user] = await Promise.all([
        db.event.findFirst({
          where: { id: input.eventId, task: { userId } },
          include: {
            task: {
              select: {
                title: true,
                course: { select: { meetings: true } },
              },
            },
          },
        }),
        db.user.findUnique({
          where: { id: userId },
          select: { timezone: true, googleSyncEnabled: true, calendarSyncProviders: true },
        }),
      ]);
      if (!existingEvent) throw new TRPCError({ code: 'NOT_FOUND' });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });

      const timezoneConverter = createTimezoneConverter(user.timezone);
      const requestedStartLocal = timezoneConverter.toZoned(input.startAt);
      const sameDayStartLocal = new Date(requestedStartLocal);
      sameDayStartLocal.setHours(0, 0, 0, 0);
      const sameDayEndLocal = new Date(requestedStartLocal);
      sameDayEndLocal.setHours(23, 59, 59, 999);
      const sameDayStart = timezoneConverter.toUtc(sameDayStartLocal);
      const sameDayEnd = timezoneConverter.toUtc(sameDayEndLocal);

      const existing: EventModel[] = await db.event.findMany({
        where: {
          task: { userId },
          id: { not: input.eventId },
          AND: { startAt: { lt: sameDayEnd }, endAt: { gt: sameDayStart } },
        },
      });

      let nextStart = input.startAt;
      let nextEnd = input.endAt;

      const meetingIntervals = meetingsToIntervalsForDate(
        existingEvent.task?.course?.meetings ?? [],
        requestedStartLocal,
      );
      const requestedEndLocal = timezoneConverter.toZoned(input.endAt);
      const overlapsClass = meetingIntervals.some(
        (interval) => requestedStartLocal < interval.endAt && interval.startAt < requestedEndLocal,
      );
      const overlapsEvent = existing.some((e) => input.startAt < e.endAt && e.startAt < input.endAt);

      if (overlapsEvent || overlapsClass) {
        // Try to reslot forward on same day using the requested duration
        const durationMin = Math.round((input.endAt.getTime() - input.startAt.getTime()) / 60000);
        const intervals: Interval[] = existing.map((e) =>
          timezoneConverter.intervalToZoned({ startAt: new Date(e.startAt), endAt: new Date(e.endAt) })
        );
        const blockingIntervals = intervals.concat(meetingIntervals);
        const slotLocal = findNonOverlappingSlot({
          desiredStart: requestedStartLocal,
          durationMinutes: durationMin,
          dayWindowStartHour: input.dayWindowStartHour,
          dayWindowEndHour: input.dayWindowEndHour,
          existing: blockingIntervals,
          stepMinutes: 15,
        });
        if (!slotLocal) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Cannot move without overlapping events or class meetings',
          });
        }
        const slot = timezoneConverter.intervalToUtc(slotLocal);
        nextStart = slot.startAt;
        nextEnd = slot.endAt;
      }

      const providers = resolveProvidersForUser(user.calendarSyncProviders, user.googleSyncEnabled);
      const existingRefs = parseExternalRefs(existingEvent.externalSyncRefs);
      const syncOutcome = await syncEventUpdate({
        userId,
        taskId: existingEvent.taskId,
        eventId: existingEvent.id,
        providers,
        payload: {
          summary: existingEvent.task?.title ?? 'Scheduled task',
          startAt: nextStart,
          endAt: nextEnd,
          timezone: user.timezone,
        },
        existingRefs,
      });

      const finalEvent = await db.event.update({
        where: { id: input.eventId },
        data: {
          startAt: nextStart,
          endAt: nextEnd,
          googleEventId: syncOutcome.refs[CalendarProvider.GOOGLE] ?? null,
          externalSyncRefs: serializeExternalRefs(syncOutcome.refs),
        },
      });

      return { event: finalEvent, syncWarnings: syncOutcome.warnings };
    }),
  ical: protectedProcedure
    .input(z.object({ start: z.date().optional(), end: z.date().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const where: Prisma.EventWhereInput = { task: { userId } };
      if (input?.start && input?.end) {
        where.OR = [
          { startAt: { gte: input.start, lt: input.end } },
          { endAt: { gt: input.start, lte: input.end } },
        ];
      }
      const events = await db.event.findMany({ where, include: { task: true } });
      const formatDate = (d: Date) => {
        const pad = (n: number) => `${n}`.padStart(2, '0');
        return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
      };
      const escapeText = (text: string) =>
        text.replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\r?\n/g, '\\n');
      const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//student-task-scheduler//EN',
      ];
      for (const e of events) {
        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${e.id}`);
        lines.push(`DTSTAMP:${formatDate(new Date())}`);
        lines.push(`DTSTART:${formatDate(new Date(e.startAt))}`);
        lines.push(`DTEND:${formatDate(new Date(e.endAt))}`);
        if (e.task?.title) lines.push(`SUMMARY:${escapeText(e.task.title)}`);
        if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
        lines.push('END:VEVENT');
      }
      lines.push('END:VCALENDAR');
      return lines.join('\r\n');
    }),
  syncGoogle: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { googleSyncEnabled: true, calendarSyncProviders: true },
    });
    if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
    const providers = resolveProvidersForUser(user.calendarSyncProviders, user.googleSyncEnabled);
    if (!providers.includes(CalendarProvider.GOOGLE)) return [];

    const sync = await withGoogleClient(userId, async (calendar) => {
      const items: calendar_v3.Schema$Event[] = [];
      let pageToken: string | undefined;
      do {
        const res = await calendar.events.list({ calendarId: 'primary', maxResults: 2500, pageToken });
        items.push(...(res.data.items ?? []));
        pageToken = res.data.nextPageToken || undefined;
      } while (pageToken);

      const googleIds = new Set<string>();
      for (const item of items) {
        const summary = item.summary;
        const start = item.start?.dateTime;
        const end = item.end?.dateTime;
        const id = item.id;
        if (id) googleIds.add(id);
        if (!summary || !start || !end || !id) continue;

        const existing = await db.event.findFirst({
          where: { googleEventId: id, task: { userId } },
          include: { task: true },
        });
        if (existing) {
          const refs = parseExternalRefs(existing.externalSyncRefs);
          refs[CalendarProvider.GOOGLE] = id;
          await db.event.update({
            where: { id: existing.id },
            data: {
              startAt: new Date(start),
              endAt: new Date(end),
              googleEventId: id,
              externalSyncRefs: serializeExternalRefs(refs),
            },
          });
          if (existing.task.title !== summary) {
            await db.task.update({ where: { id: existing.taskId }, data: { title: summary } });
          }
        } else {
          const task = await db.task.create({ data: { title: summary, userId } });
          const refs = serializeExternalRefs({ [CalendarProvider.GOOGLE]: id });
          await db.event.create({
            data: {
              taskId: task.id,
              startAt: new Date(start),
              endAt: new Date(end),
              googleEventId: id,
              externalSyncRefs: refs,
            },
          });
        }
      }

      const locals = await db.event.findMany({
        where: { task: { userId }, googleEventId: null },
        include: { task: true },
      });
      for (const e of locals) {
        const inserted = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: e.task?.title ?? '',
            start: { dateTime: e.startAt.toISOString() },
            end: { dateTime: e.endAt.toISOString() },
          },
        });
        const insertedId = inserted.data.id || undefined;
        if (insertedId) {
          googleIds.add(insertedId);
          const refs = parseExternalRefs(e.externalSyncRefs);
          refs[CalendarProvider.GOOGLE] = insertedId;
          await db.event.update({
            where: { id: e.id },
            data: {
              googleEventId: insertedId,
              externalSyncRefs: serializeExternalRefs(refs),
            },
          });
        }
      }

      await db.event.deleteMany({
        where: {
          task: { userId },
          googleEventId: { notIn: Array.from(googleIds), not: null },
        },
      });

      return Array.from(googleIds);
    });

    if (sync.error) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: sync.error });
    }

    return sync.result ?? [];
  }),
});
