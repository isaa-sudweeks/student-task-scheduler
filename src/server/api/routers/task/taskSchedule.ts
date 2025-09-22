import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { TaskStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { router, protectedProcedure } from '../../trpc';
import { db } from '@/server/db';
import { invalidateTaskListCache, requireUserId } from './utils';
import { generateScheduleSuggestions, type SchedulerTask } from '@/server/ai/scheduler';

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
  scheduleSuggestions: protectedProcedure
    .input(z.object({ taskIds: z.array(z.string().min(1)).min(1).optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          timezone: true,
          dayWindowStartHour: true,
          dayWindowEndHour: true,
          defaultDurationMinutes: true,
          llmProvider: true,
          openaiApiKey: true,
          lmStudioUrl: true,
        },
      });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });

      const taskWhere: Prisma.TaskWhereInput = {
        userId,
        status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
        events: { none: {} },
      };
      if (input?.taskIds?.length) {
        taskWhere.id = { in: input.taskIds };
      }

      const tasksRaw = await db.task.findMany({
        where: taskWhere,
        select: {
          id: true,
          title: true,
          dueAt: true,
          effortMinutes: true,
          priority: true,
          createdAt: true,
          notes: true,
        },
        orderBy: [
          { dueAt: { sort: 'asc', nulls: 'last' } },
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
      });

      if (tasksRaw.length === 0) return { suggestions: [] };

      const tasks: SchedulerTask[] = tasksRaw.map((task) => ({
        id: task.id,
        title: task.title,
        dueAt: task.dueAt,
        effortMinutes: task.effortMinutes,
        priority: task.priority,
        createdAt: task.createdAt,
        notes: task.notes,
      }));

      const events = await db.event.findMany({
        where: { task: { userId } },
        select: { startAt: true, endAt: true },
      });

      const suggestions = await generateScheduleSuggestions({
        tasks,
        user,
        existingEvents: events,
      });

      return { suggestions };
    }),
});
