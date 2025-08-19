import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure, router } from '../trpc';
import { db } from '@/server/db';
import { findNonOverlappingSlot } from '@/lib/scheduling';

export const eventRouter = router({
  listRange: publicProcedure
    .input(z.object({ start: z.date().optional(), end: z.date().optional() }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.start && input?.end) {
        where.OR = [
          { startAt: { gte: input.start, lt: input.end } },
          { endAt: { gt: input.start, lte: input.end } },
        ];
      }
      return (db as any).event.findMany({ where });
    }),
  schedule: publicProcedure
    .input(z.object({ taskId: z.string().min(1), startAt: z.date(), durationMinutes: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const duration = input.durationMinutes;
      const desiredStart = input.startAt;
      const desiredEnd = new Date(desiredStart.getTime() + duration * 60_000);

      const sameDayStart = new Date(desiredStart);
      sameDayStart.setHours(0, 0, 0, 0);
      const sameDayEnd = new Date(desiredStart);
      sameDayEnd.setHours(23, 59, 59, 999);

      const existing = await (db as any).event.findMany({
        where: {
          // Consider same day events for overlap avoidance
          OR: [
            { startAt: { gte: sameDayStart, lte: sameDayEnd } },
            { endAt: { gte: sameDayStart, lte: sameDayEnd } },
          ],
        },
      });

      const slot = findNonOverlappingSlot({
        desiredStart,
        durationMinutes: duration,
        dayWindowStartHour: 8,
        dayWindowEndHour: 18,
        existing: existing.map((e: any) => ({ startAt: new Date(e.startAt), endAt: new Date(e.endAt) })),
        stepMinutes: 15,
      });

      if (!slot) {
        throw new TRPCError({ code: 'CONFLICT', message: 'No available time slot without overlap' });
      }

      return (db as any).event.create({ data: { taskId: input.taskId, startAt: slot.startAt, endAt: slot.endAt } });
    }),
  move: publicProcedure
    .input(z.object({ eventId: z.string().min(1), startAt: z.date(), endAt: z.date() }))
    .mutation(async ({ input }) => {
      if (input.endAt <= input.startAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'End must be after start' });
      }

      const sameDayStart = new Date(input.startAt);
      sameDayStart.setHours(0, 0, 0, 0);
      const sameDayEnd = new Date(input.startAt);
      sameDayEnd.setHours(23, 59, 59, 999);

      const existing = await (db as any).event.findMany({
        where: {
          id: { not: input.eventId },
          OR: [
            { startAt: { gte: sameDayStart, lte: sameDayEnd } },
            { endAt: { gte: sameDayStart, lte: sameDayEnd } },
          ],
        },
      });

      const overlaps = existing.some((e: any) => input.startAt < new Date(e.endAt) && new Date(e.startAt) < input.endAt);
      if (overlaps) {
        // Try to reslot forward on same day using the requested duration
        const durationMin = Math.round((input.endAt.getTime() - input.startAt.getTime()) / 60000);
        const slot = findNonOverlappingSlot({
          desiredStart: input.startAt,
          durationMinutes: durationMin,
          dayWindowStartHour: 8,
          dayWindowEndHour: 18,
          existing: existing.map((e: any) => ({ startAt: new Date(e.startAt), endAt: new Date(e.endAt) })),
          stepMinutes: 15,
        });
        if (!slot) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Cannot move without overlapping any event' });
        }
        return (db as any).event.update({ where: { id: input.eventId }, data: { startAt: slot.startAt, endAt: slot.endAt } });
      }

      return (db as any).event.update({ where: { id: input.eventId }, data: { startAt: input.startAt, endAt: input.endAt } });
    }),
});

