import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure, router } from '../trpc';
import { db } from '@/server/db';
export const taskRouter = router({
  // No authentication: list all tasks
  list: publicProcedure
    .input(z.object({ filter: z.enum(['all','overdue','today']).optional() }).optional())
    .query(async ({ input }) => {
      const filter = input?.filter ?? 'all';
      const now = new Date();

      // Compute today window
      const startOfToday = new Date(now);
      startOfToday.setHours(0,0,0,0);
      const endOfToday = new Date(now);
      endOfToday.setHours(23,59,59,999);

      const where =
        filter === 'overdue'
          ? { dueAt: { lt: now } }
          : filter === 'today'
          ? { dueAt: { gte: startOfToday, lte: endOfToday } }
          : undefined;

      return db.task.findMany({
        where,
        orderBy: [
          { dueAt: { sort: 'asc', nulls: 'last' } as any },
          { createdAt: 'desc' },
        ],
        select: { id: true, title: true, createdAt: true, dueAt: true },
      });
    }),
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        dueAt: z.date().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.dueAt && input.dueAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Due date cannot be in the past' });
      }
      return db.task.create({ data: { title: input.title, dueAt: input.dueAt ?? null } });
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
  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return db.task.delete({ where: { id: input.id } });
    }),
});
