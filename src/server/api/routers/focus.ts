import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { db } from '@/server/db';
import type { TaskTimeLog } from '@prisma/client';

export const focusRouter = router({
  start: protectedProcedure
    .input(z.object({ taskId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      // End any existing open log for this user's tasks
      await db.taskTimeLog.updateMany({
        where: { endedAt: null, task: { userId } },
        data: { endedAt: new Date() },
      });
      return db.taskTimeLog.create({
        data: { taskId: input.taskId, userId, startedAt: new Date(), endedAt: null },
      });
    }),
  stop: protectedProcedure
    .input(z.object({ taskId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const open: TaskTimeLog | null = await db.taskTimeLog.findFirst({
        where: {
          taskId: input.taskId,
          endedAt: null,
          task: { userId },
        },
        orderBy: { startedAt: 'desc' },
      });
      if (!open) return { ok: true };
      await db.taskTimeLog.update({
        where: { id: open.id },
        data: { endedAt: new Date() },
      });
      return { ok: true };
    }),
  aggregate: protectedProcedure
    .input(
      z
        .object({ start: z.date().optional(), end: z.date().optional() })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const rangeStart = input?.start ?? new Date(0);
      const rangeEnd = input?.end ?? new Date();
      const logs = await db.taskTimeLog.findMany({
        where: {
          startedAt: { lte: rangeEnd },
          OR: [{ endedAt: { gte: rangeStart } }, { endedAt: null }],
          task: { userId },
        },
      });
      const now = new Date();
      const totals: Record<string, number> = {};
      for (const log of logs) {
        const start = log.startedAt < rangeStart ? rangeStart : log.startedAt;
        const rawEnd = log.endedAt ?? now;
        const end = rawEnd > rangeEnd ? rangeEnd : rawEnd;
        if (end > start) {
          totals[log.taskId] =
            (totals[log.taskId] ?? 0) + (end.getTime() - start.getTime());
        }
      }
      return Object.entries(totals).map(([taskId, durationMs]) => ({
        taskId,
        durationMs,
      }));
    }),
});
