import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { db } from '@/server/db';
import { TRPCError } from '@trpc/server';
import { LlmProvider } from '@prisma/client';

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
        llmProvider: true,
        openaiApiKey: true,
        lmStudioUrl: true,
        focusWorkMinutes: true,
        focusBreakMinutes: true,
        focusCycleCount: true,
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
      llmProvider: z.nativeEnum(LlmProvider),
      openaiApiKey: z.string().max(512).optional().nullable(),
      lmStudioUrl: z.string().url(),
      focusWorkMinutes: z.number().int().min(5).max(24 * 60),
      focusBreakMinutes: z.number().int().min(1).max(24 * 60),
      focusCycleCount: z.number().int().min(1).max(12),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const trimmedApiKey = input.openaiApiKey?.trim() ?? null;
      if (input.dayWindowEndHour <= input.dayWindowStartHour) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Day window end hour must be later than the start hour.',
        });
      }
      if (input.llmProvider === LlmProvider.OPENAI && !trimmedApiKey) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'OpenAI API key is required when using the OpenAI provider.',
        });
      }
      await db.user.update({
        where: { id: userId },
        data: {
          timezone: input.timezone,
          dayWindowStartHour: input.dayWindowStartHour,
          dayWindowEndHour: input.dayWindowEndHour,
          defaultDurationMinutes: input.defaultDurationMinutes,
          googleSyncEnabled: input.googleSyncEnabled,
          llmProvider: input.llmProvider,
          openaiApiKey: trimmedApiKey,
          lmStudioUrl: input.lmStudioUrl,
          focusWorkMinutes: input.focusWorkMinutes,
          focusBreakMinutes: input.focusBreakMinutes,
          focusCycleCount: input.focusCycleCount,
        },
      });
      return { success: true };
    }),
});
