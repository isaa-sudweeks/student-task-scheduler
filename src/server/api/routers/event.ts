import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../trpc';
import { db } from '@/server/db';
import { findNonOverlappingSlot, Interval } from '@/lib/scheduling';
import type { Event as EventModel, Prisma } from '@prisma/client';
import { google } from 'googleapis';

export const eventRouter = router({
  listRange: protectedProcedure
    .input(z.object({ start: z.date().optional(), end: z.date().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const where: Prisma.EventWhereInput = { task: { userId } };
      if (input?.start && input?.end) {
        where.OR = [
          { startAt: { gte: input.start, lt: input.end } },
          { endAt: { gt: input.start, lte: input.end } },
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
      const userId = ctx.session.user.id;

      const task = await db.task.findFirst({ where: { id: input.taskId, userId } });
      if (!task) throw new TRPCError({ code: 'NOT_FOUND' });

      const sameDayStart = new Date(desiredStart);
      sameDayStart.setHours(0, 0, 0, 0);
      const sameDayEnd = new Date(desiredStart);
      sameDayEnd.setHours(23, 59, 59, 999);

      const existing: EventModel[] = await db.event.findMany({
        where: {
          task: { userId },
          // Consider same day events for overlap avoidance
          OR: [
            { startAt: { gte: sameDayStart, lte: sameDayEnd } },
            { endAt: { gte: sameDayStart, lte: sameDayEnd } },
          ],
        },
      });

      const intervals: Interval[] = existing.map((e) => ({ startAt: new Date(e.startAt), endAt: new Date(e.endAt) }));

      const slot = findNonOverlappingSlot({
        desiredStart,
        durationMinutes: duration,
        dayWindowStartHour,
        dayWindowEndHour,
        existing: intervals,
        stepMinutes: 15,
      });

      if (!slot) {
        throw new TRPCError({ code: 'CONFLICT', message: 'No available time slot without overlap' });
      }

      return db.event.create({ data: { taskId: input.taskId, startAt: slot.startAt, endAt: slot.endAt } });
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

      const userId = ctx.session.user.id;
      const existingEvent = await db.event.findFirst({ where: { id: input.eventId, task: { userId } } });
      if (!existingEvent) throw new TRPCError({ code: 'NOT_FOUND' });

      const sameDayStart = new Date(input.startAt);
      sameDayStart.setHours(0, 0, 0, 0);
      const sameDayEnd = new Date(input.startAt);
      sameDayEnd.setHours(23, 59, 59, 999);

      const existing: EventModel[] = await db.event.findMany({
        where: {
          task: { userId },
          id: { not: input.eventId },
          OR: [
            { startAt: { gte: sameDayStart, lte: sameDayEnd } },
            { endAt: { gte: sameDayStart, lte: sameDayEnd } },
          ],
        },
      });

      const overlaps = existing.some((e) => input.startAt < e.endAt && e.startAt < input.endAt);
      if (overlaps) {
        // Try to reslot forward on same day using the requested duration
        const durationMin = Math.round((input.endAt.getTime() - input.startAt.getTime()) / 60000);
        const intervals: Interval[] = existing.map((e) => ({ startAt: e.startAt, endAt: e.endAt }));
        const slot = findNonOverlappingSlot({
          desiredStart: input.startAt,
          durationMinutes: durationMin,
          dayWindowStartHour: input.dayWindowStartHour,
          dayWindowEndHour: input.dayWindowEndHour,
          existing: intervals,
          stepMinutes: 15,
        });
        if (!slot) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Cannot move without overlapping any event' });
        }
        return db.event.update({ where: { id: input.eventId }, data: { startAt: slot.startAt, endAt: slot.endAt } });
      }

      return db.event.update({ where: { id: input.eventId }, data: { startAt: input.startAt, endAt: input.endAt } });
    }),
  ical: protectedProcedure
    .input(z.object({ start: z.date().optional(), end: z.date().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
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
        if (e.task?.title) lines.push(`SUMMARY:${e.task.title}`);
        if (e.location) lines.push(`LOCATION:${e.location}`);
        lines.push('END:VEVENT');
      }
      lines.push('END:VCALENDAR');
      return lines.join('\r\n');
    }),
  syncGoogle: protectedProcedure
    .input(
      z.object({ accessToken: z.string(), refreshToken: z.string().optional() })
    )
    .mutation(async ({ input }) => {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: input.accessToken,
        refresh_token: input.refreshToken,
      });
      const calendar = google.calendar({ version: 'v3', auth });
      const res = await calendar.events.list({ calendarId: 'primary', maxResults: 10 });
      return res.data.items ?? [];
    }),
});

