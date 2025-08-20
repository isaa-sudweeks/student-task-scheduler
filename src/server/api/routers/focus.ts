import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db } from '@/server/db';
import type { TaskTimeLog } from '@prisma/client';

export const focusRouter = router({
  start: publicProcedure
    .input(z.object({ taskId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      // End any existing open log for any task
      await db.taskTimeLog.updateMany({ where: { endedAt: null }, data: { endedAt: new Date() } });
      return db.taskTimeLog.create({ data: { taskId: input.taskId, startedAt: new Date(), endedAt: null } });
    }),
  stop: publicProcedure
    .input(z.object({ taskId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const open: TaskTimeLog | null = await db.taskTimeLog.findFirst({
        where: { taskId: input.taskId, endedAt: null },
        orderBy: { startedAt: 'desc' },
      });
      if (!open) return { ok: true };
      await db.taskTimeLog.update({ where: { id: open.id }, data: { endedAt: new Date() } });
      return { ok: true };
    }),
});

