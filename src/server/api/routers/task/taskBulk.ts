import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc';
import { db } from '@/server/db';
import { invalidateTaskListCache, requireUserId } from './utils';

export const taskBulkRouter = router({
  bulkUpdate: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string().min(1)),
        status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      await db.task.updateMany({
        where: { id: { in: input.ids }, userId },
        data: { status: input.status },
      });
      await invalidateTaskListCache(userId);
      return { success: true };
    }),
  bulkDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.string().min(1)) }))
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      await db.$transaction([
        db.reminder.deleteMany({ where: { taskId: { in: input.ids }, task: { userId } } }),
        db.event.deleteMany({ where: { taskId: { in: input.ids }, task: { userId } } }),
        db.task.deleteMany({ where: { id: { in: input.ids }, userId } }),
      ]);
      await invalidateTaskListCache(userId);
      return { success: true };
    }),
});
