import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';
import type { Event as EventModel, Prisma } from '@prisma/client';

import { findNonOverlappingSlot, Interval } from '@/lib/scheduling';
import { createTimezoneConverter } from '@/server/ai/timezone';
import { db } from '@/server/db';
import { env } from '@/env';
import { protectedProcedure, router } from '../trpc';
import { meetingsToIntervalsForDate } from '@/server/utils/courseMeetings';

type GoogleAccountCredentials = {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
};

const createGoogleAuthClient = (account: GoogleAccountCredentials) => {
  const auth = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  let credentialsState: {
    access_token?: string;
    refresh_token?: string;
    expiry_date?: number;
  } = {
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
          select: { timezone: true, googleSyncEnabled: true },
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

      let googleEventId: string | undefined;
      let googleSyncWarning = false;
      if (user.googleSyncEnabled) {
        const account = await db.account.findFirst({
          where: { userId, provider: 'google' },
          select: { access_token: true, refresh_token: true, expires_at: true },
        });
        if (account?.access_token) {
          const { auth, refreshIfExpired } = createGoogleAuthClient({
            access_token: account.access_token,
            refresh_token: account.refresh_token ?? null,
            expires_at: account.expires_at ?? null,
          });
          let canSync = true;
          try {
            await refreshIfExpired();
          } catch (error) {
            console.error('Failed to refresh Google access token', error);
            googleSyncWarning = true;
            canSync = false;
          }

          if (canSync) {
            const calendar = google.calendar({ version: 'v3', auth });
            try {
              const res = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: {
                  summary: task.title,
                  start: { dateTime: slot.startAt.toISOString() },
                  end: { dateTime: slot.endAt.toISOString() },
                },
              });
              googleEventId = res.data.id || undefined;
            } catch (error) {
              console.error('Failed to sync with Google Calendar', error);
              googleSyncWarning = true;
            }
          }
        }
      }

      const event = await db.event.create({
        data: {
          taskId: input.taskId,
          startAt: slot.startAt,
          endAt: slot.endAt,
          ...(googleEventId ? { googleEventId } : {}),
        },
      });

      return { event, googleSyncWarning };
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
          include: { task: { select: { course: { select: { meetings: true } } } } },
        }),
        db.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
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
        return db.event.update({ where: { id: input.eventId }, data: { startAt: slot.startAt, endAt: slot.endAt } });
      }

      return db.event.update({ where: { id: input.eventId }, data: { startAt: input.startAt, endAt: input.endAt } });
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
      select: { googleSyncEnabled: true },
    });
    if (!user?.googleSyncEnabled) return [];

    const account = await db.account.findFirst({
      where: { userId, provider: 'google' },
      select: { access_token: true, refresh_token: true, expires_at: true },
    });
    if (!account?.access_token) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing Google auth' });
    }

    const { auth, refreshIfExpired } = createGoogleAuthClient({
      access_token: account.access_token,
      refresh_token: account.refresh_token ?? null,
      expires_at: account.expires_at ?? null,
    });

    try {
      await refreshIfExpired();
    } catch (error) {
      console.error('Failed to refresh Google access token', error);
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Unable to refresh Google access token. Please reconnect Google sync.',
      });
    }

    const calendar = google.calendar({ version: 'v3', auth });

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
        await db.event.update({
          where: { id: existing.id },
          data: { startAt: new Date(start), endAt: new Date(end) },
        });
        if (existing.task.title !== summary) {
          await db.task.update({ where: { id: existing.taskId }, data: { title: summary } });
        }
      } else {
        const task = await db.task.create({ data: { title: summary, userId } });
        await db.event.create({
          data: {
            taskId: task.id,
            startAt: new Date(start),
            endAt: new Date(end),
            googleEventId: id,
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
      if (insertedId) googleIds.add(insertedId);
      await db.event.update({
        where: { id: e.id },
        data: { googleEventId: insertedId },
      });
    }

    await db.event.deleteMany({
      where: {
        task: { userId },
        googleEventId: { notIn: Array.from(googleIds), not: null },
      },
    });

    return Array.from(googleIds);
  }),
});
