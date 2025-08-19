import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db } from '@/server/db';

export const focusRouter = router({
  start: publicProcedure
    .input(z.object({ taskId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      // End any existing open log for any task
      await (db as any).taskTimeLog.updateMany({ where: { endedAt: null }, data: { endedAt: new Date() } });
      return (db as any).taskTimeLog.create({ data: { taskId: input.taskId, startedAt: new Date(), endedAt: null } });
    }),
  stop: publicProcedure
    .input(z.object({ taskId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const open = await (db as any).taskTimeLog.findFirst({ where: { taskId: input.taskId, endedAt: null }, orderBy: { startedAt: 'desc' } });
      if (!open) return { ok: true };
      await (db as any).taskTimeLog.update({ where: { id: open.id }, data: { endedAt: new Date() } });
      return { ok: true };
    }),
});

