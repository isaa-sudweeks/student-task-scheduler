import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { db } from '@/server/db';
import { TRPCError } from '@trpc/server';
import { GoalType, CalendarProvider, LlmProvider } from '@prisma/client';

export const userRouter = router({
  get: protectedProcedure.query(({ ctx }) => {
    return ctx.session.user;
  }),
  listGoals: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const goals = await db.studyGoal.findMany({
      where: { userId },
      include: { course: { select: { id: true, title: true } } },
      orderBy: [{ type: 'asc' }, { subject: 'asc' }, { courseId: 'asc' }],
    });

    return goals.map((goal) => ({
      ...goal,
      label:
        goal.type === GoalType.COURSE
          ? goal.course?.title ?? 'Course goal'
          : goal.subject ?? 'Uncategorized',
    }));
  }),
  setTimezone: protectedProcedure
    .input(z.object({ timezone: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await db.user.update({ where: { id: userId }, data: { timezone: input.timezone } });
      return { success: true };
    }),
  upsertGoal: protectedProcedure
    .input(
      z
        .object({
          type: z.nativeEnum(GoalType),
          subject: z.string().min(1).max(100).optional(),
          courseId: z.string().min(1).optional(),
          targetMinutes: z.number().int().min(0).max(7 * 24 * 60),
        })
        .superRefine((value, ctx) => {
          if (value.type === GoalType.SUBJECT) {
            if (!value.subject?.trim()) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Subject is required for subject goals.',
                path: ['subject'],
              });
            }
            if (value.courseId) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Subject goals cannot include a course.',
                path: ['courseId'],
              });
            }
          }
          if (value.type === GoalType.COURSE) {
            if (!value.courseId) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Course is required for course goals.',
                path: ['courseId'],
              });
            }
            if (value.subject) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Course goals cannot provide a subject.',
                path: ['subject'],
              });
            }
          }
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      if (input.type === GoalType.COURSE) {
        const course = await db.course.findFirst({
          where: { id: input.courseId!, userId },
        });
        if (!course) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
        }
      }

      const subject = input.type === GoalType.SUBJECT ? input.subject!.trim() : null;
      const courseId = input.type === GoalType.COURSE ? input.courseId! : null;

      const goal = await db.studyGoal.upsert({
        where:
          input.type === GoalType.SUBJECT
            ? {
              userId_type_subject: {
                userId,
                type: GoalType.SUBJECT,
                subject: subject!,
              },
            }
            : {
              userId_courseId: {
                userId,
                courseId: courseId!,
              },
            },
        update: { targetMinutes: input.targetMinutes, subject, courseId },
        create: {
          userId,
          type: input.type,
          subject,
          courseId,
          targetMinutes: input.targetMinutes,
        },
        include: { course: { select: { id: true, title: true } } },
      });

      return {
        ...goal,
        label:
          goal.type === GoalType.COURSE
            ? goal.course?.title ?? 'Course goal'
            : goal.subject ?? 'Uncategorized',
      };
    }),
  deleteGoal: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const deleted = await db.studyGoal.deleteMany({
        where: { id: input.id, userId },
      });
      if (deleted.count === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Goal not found' });
      }
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
        calendarSyncProviders: true,
        llmProvider: true,
        openaiApiKey: true,
        lmStudioUrl: true,
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
      calendarSyncProviders: z.array(z.nativeEnum(CalendarProvider)).min(1).max(3),
      llmProvider: z.nativeEnum(LlmProvider),
      openaiApiKey: z.string().max(512).optional().nullable(),
      lmStudioUrl: z.string().url(),
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
          googleSyncEnabled: input.calendarSyncProviders.includes(CalendarProvider.GOOGLE),
          calendarSyncProviders: input.calendarSyncProviders,
          llmProvider: input.llmProvider,
          openaiApiKey: trimmedApiKey,
          lmStudioUrl: input.lmStudioUrl,
        },
      });
      return { success: true };
    }),
});
