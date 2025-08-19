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
          filter: z.enum(['all', 'overdue', 'today', 'archive']).optional(),
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

      // Hide DONE tasks from all regular filters; show only DONE in archive
      const baseWhere =
        filter === 'archive'
          ? ({ status: 'DONE' } as any)
          : ({ status: { not: 'DONE' } } as any);

      const where =
        filter === 'overdue'
          ? { ...baseWhere, dueAt: { lt: nowUtc } }
          : filter === 'today'
          ? { ...baseWhere, dueAt: { gte: startUtc, lte: endUtc } }
          : baseWhere;

      return (db as any).task.findMany({
        where,
        orderBy: [
          // Respect manual ordering first
          { position: 'asc' },
          // Then sort by due date (nulls last) for items with equal positions
          { dueAt: { sort: 'asc', nulls: 'last' } as any },
          // Finally, newest first as a tiebreaker
          { createdAt: 'desc' },
        ],
      });
    }),
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        dueAt: z.date().nullable().optional(),
        subject: z.string().max(100).optional(),
        notes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.dueAt && input.dueAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Due date cannot be in the past' });
      }
      return (db as any).task.create({
        data: {
          title: input.title,
          dueAt: input.dueAt ?? null,
          subject: input.subject ?? null,
          notes: input.notes ?? null,
        },
      });
    }),
  update: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(200).optional(),
        subject: z.string().max(100).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
        dueAt: z.date().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.dueAt && input.dueAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Due date cannot be in the past' });
      }
      const { id, ...rest } = input;
      const data: Record<string, any> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (typeof value !== 'undefined') data[key] = value;
      }
      if (Object.keys(data).length === 0) return db.task.findUniqueOrThrow({ where: { id } });
      return db.task.update({ where: { id }, data });
    }),
  setDueDate: publicProcedure
    .input(
      z.object({ id: z.string().min(1), dueAt: z.date().nullable() })
    )
    .mutation(async ({ input }) => {
      if (input.dueAt && input.dueAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Due date cannot be in the past' });
      }
      return (db as any).task.update({ where: { id: input.id }, data: { dueAt: input.dueAt ?? null } });
    }),
  updateTitle: publicProcedure
    .input(
      z.object({ id: z.string().min(1), title: z.string().min(1).max(200) })
    )
    .mutation(async ({ input }) => {
      return (db as any).task.update({ where: { id: input.id }, data: { title: input.title } });
    }),
  setStatus: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]),
      })
    )
    .mutation(async ({ input }) => {
      return (db as any).task.update({
        where: { id: input.id },
        data: { status: input.status as TaskStatus },
      });
    }),
  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      // Be resilient even if DB referential actions aren't cascaded yet
      const [, , deleted] = await (db as any).$transaction([
        (db as any).reminder.deleteMany({ where: { taskId: input.id } }),
        (db as any).event.deleteMany({ where: { taskId: input.id } }),
        (db as any).task.delete({ where: { id: input.id } }),
      ]);
      return deleted;
    }),
  reorder: publicProcedure
    .input(z.object({ ids: z.array(z.string().min(1)) }))
    .mutation(async ({ input }) => {
      await (db as any).$transaction(
        input.ids.map((id, index) =>
          (db as any).task.update({ where: { id }, data: { position: index } })
        )
      );
      return { success: true };
    }),
});
