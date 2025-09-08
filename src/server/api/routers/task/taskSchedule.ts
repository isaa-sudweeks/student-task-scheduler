import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc';
import { db } from '@/server/db';
import { invalidateTaskListCache, requireUserId } from './utils';

export const taskScheduleRouter = router({
  reorder: protectedProcedure
    .input(z.object({ ids: z.array(z.string().min(1)) }))
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      const tasks = await db.task.findMany({
        where: { id: { in: input.ids }, userId },
        select: { id: true },
      });
      if (tasks.length !== input.ids.length) throw new TRPCError({ code: 'NOT_FOUND' });
      await db.$transaction(
        input.ids.map((id, index) =>
          db.task.update({ where: { id }, data: { position: index + 1 } }),
        ),
      );
      await invalidateTaskListCache(userId);
      return { success: true };
    }),
});
