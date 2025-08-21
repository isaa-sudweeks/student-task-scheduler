import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db } from '@/server/db';
import { TRPCError } from '@trpc/server';

export const userRouter = router({
  get: publicProcedure.query(({ ctx }) => {
    return ctx.session?.user ?? null;
  }),
  setTimezone: publicProcedure
    .input(z.object({ timezone: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }
      await db.user.update({ where: { id: userId }, data: { timezone: input.timezone } });
      return { success: true };
    }),
});
