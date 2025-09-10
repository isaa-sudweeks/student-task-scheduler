import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { db } from '@/server/db';
import { TRPCError } from '@trpc/server';

export const userRouter = router({
  get: protectedProcedure.query(({ ctx }) => {
    return ctx.session.user;
  }),
  setTimezone: protectedProcedure
    .input(z.object({ timezone: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await db.user.update({ where: { id: userId }, data: { timezone: input.timezone } });
      return { success: true };
    }),
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        timezone: true,
        dayWindowStartHour: true,
        dayWindowEndHour: true,
        defaultDurationMinutes: true,
        googleSyncEnabled: true,
      },
    });
    if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
    return user;
  }),
  setSettings: protectedProcedure
    .input(z.object({
      timezone: z.string(),
      dayWindowStartHour: z.number().int().min(0).max(23),
      dayWindowEndHour: z.number().int().min(0).max(23),
      defaultDurationMinutes: z.number().int().min(1).max(24 * 60),
      googleSyncEnabled: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await db.user.update({
        where: { id: userId },
        data: {
          timezone: input.timezone,
          dayWindowStartHour: input.dayWindowStartHour,
          dayWindowEndHour: input.dayWindowEndHour,
          defaultDurationMinutes: input.defaultDurationMinutes,
          googleSyncEnabled: input.googleSyncEnabled,
        },
      });
      return { success: true };
    }),
});
