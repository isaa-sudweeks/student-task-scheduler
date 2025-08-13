import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { TaskStatus } from '@prisma/client';
import { publicProcedure, router } from '../trpc';
import { db } from '@/server/db';
export const taskRouter = router({
  // No authentication: list all tasks
  list: publicProcedure
    .input(
      z
        .object({
          filter: z.enum(['all', 'overdue', 'today']).optional(),
          // Minutes to add to UTC to get client local time offset (Date.getTimezoneOffset style)
          tzOffsetMinutes: z.number().int().optional(),
          // Optional explicit client-local day bounds as absolute instants
          todayStart: z.date().optional(),
          todayEnd: z.date().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const filter = input?.filter ?? 'all';
      const tzOffsetMinutes = input?.tzOffsetMinutes ?? null;
      const nowUtc = new Date();

      // Prefer explicit bounds from client when provided; otherwise compute from tz offset
      let startUtc: Date;
      let endUtc: Date;
      if (input?.todayStart && input?.todayEnd) {
        startUtc = input.todayStart;
        endUtc = input.todayEnd;
      } else {
        const nowClient = tzOffsetMinutes != null
          ? new Date(nowUtc.getTime() - tzOffsetMinutes * 60 * 1000)
          : nowUtc;
        const startClient = new Date(nowClient);
        startClient.setHours(0, 0, 0, 0);
        const endClient = new Date(nowClient);
        endClient.setHours(23, 59, 59, 999);
        startUtc = tzOffsetMinutes != null
          ? new Date(startClient.getTime() + tzOffsetMinutes * 60 * 1000)
          : startClient;
        endUtc = tzOffsetMinutes != null
          ? new Date(endClient.getTime() + tzOffsetMinutes * 60 * 1000)
          : endClient;
      }

      const where =
        filter === 'overdue'
          ? { dueAt: { lt: nowUtc } }
          : filter === 'today'
          ? { dueAt: { gte: startUtc, lte: endUtc } }
          : undefined;

      return db.task.findMany({
        where,
        orderBy: [
          { dueAt: { sort: 'asc', nulls: 'last' } as any },
          { createdAt: 'desc' },
        ],
        select: { id: true, title: true, createdAt: true, dueAt: true, status: true, subject: true },
      });
    }),
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        dueAt: z.date().nullable().optional(),
        subject: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.dueAt && input.dueAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Due date cannot be in the past' });
      }
      return db.task.create({
        data: {
          title: input.title,
          dueAt: input.dueAt ?? null,
          subject: input.subject ?? null,
        },
      });
    }),
  setDueDate: publicProcedure
    .input(
      z.object({ id: z.string().min(1), dueAt: z.date().nullable() })
    )
    .mutation(async ({ input }) => {
      if (input.dueAt && input.dueAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Due date cannot be in the past' });
      }
      return db.task.update({ where: { id: input.id }, data: { dueAt: input.dueAt ?? null } });
    }),
  updateTitle: publicProcedure
    .input(
      z.object({ id: z.string().min(1), title: z.string().min(1).max(200) })
    )
    .mutation(async ({ input }) => {
      return db.task.update({ where: { id: input.id }, data: { title: input.title } });
    }),
  setStatus: publicProcedure
    .input(
      z.object({ id: z.string().min(1), status: z.nativeEnum(TaskStatus) })
    )
    .mutation(async ({ input }) => {
      return db.task.update({ where: { id: input.id }, data: { status: input.status } });
    }),
  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return db.task.delete({ where: { id: input.id } });
    }),
});
