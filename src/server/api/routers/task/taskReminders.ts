import { z } from 'zod';
import { ReminderChannel } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc';
import { db } from '@/server/db';
import { requireUserId } from './utils';

const MAX_REMINDERS = 5;
const MAX_OFFSET_MINUTES = 7 * 24 * 60; // one week

const reminderInputSchema = z.object({
  channel: z.nativeEnum(ReminderChannel),
  offsetMin: z
    .number()
    .int()
    .min(0, 'Lead time must be zero or greater')
    .max(MAX_OFFSET_MINUTES, 'Lead time cannot exceed one week'),
});

const reminderUpdateSchema = reminderInputSchema.extend({
  id: z.string().min(1).optional(),
});

async function assertTaskOwnership(taskId: string, userId: string) {
  const task = await db.task.findFirst({
    where: { id: taskId, userId },
    select: { id: true },
  });
  if (!task) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
  }
}

export const taskReminderRouter = router({
  listReminders: protectedProcedure
    .input(z.object({ taskId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      await assertTaskOwnership(input.taskId, userId);
      return db.reminder.findMany({
        where: { taskId: input.taskId },
        orderBy: { offsetMin: 'asc' },
      });
    }),
  replaceReminders: protectedProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        reminders: z
          .array(reminderUpdateSchema)
          .max(MAX_REMINDERS, `You can only configure up to ${MAX_REMINDERS} reminders.`),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      await assertTaskOwnership(input.taskId, userId);

      const sanitized = input.reminders.map((reminder) => reminderInputSchema.parse(reminder));

      return db.$transaction(async (tx) => {
        await tx.reminder.deleteMany({ where: { taskId: input.taskId } });
        if (sanitized.length === 0) return [];
        return Promise.all(
          sanitized.map((reminder) =>
            tx.reminder.create({
              data: {
                taskId: input.taskId,
                channel: reminder.channel,
                offsetMin: reminder.offsetMin,
              },
            }),
          ),
        );
      });
    }),
});

export type ReminderInput = z.infer<typeof reminderInputSchema>;
