import { addDays, addWeeks, addMonths } from 'date-fns';
import { db } from '@/server/db';
import { RecurrenceType } from '@prisma/client';

export async function generateRecurringTasks(now = new Date()) {
  const templates = await db.task.findMany({
    where: {
      recurrenceType: { not: RecurrenceType.NONE },
      dueAt: { not: null },
    },
  });

  for (const task of templates) {
    if (!task.dueAt) continue;
    const occurrences = await db.task.count({
      where: {
        title: task.title,
        userId: task.userId ?? undefined,
        recurrenceType: task.recurrenceType,
        recurrenceInterval: task.recurrenceInterval,
      },
    });
    if (task.recurrenceCount && occurrences >= task.recurrenceCount) continue;
    let nextDue = task.dueAt;
    while (nextDue <= now) {
      nextDue =
        task.recurrenceType === RecurrenceType.DAILY
          ? addDays(nextDue, task.recurrenceInterval)
          : task.recurrenceType === RecurrenceType.WEEKLY
          ? addWeeks(nextDue, task.recurrenceInterval)
          : addMonths(nextDue, task.recurrenceInterval);
    }
    if (task.recurrenceUntil && nextDue > task.recurrenceUntil) continue;
    const existing = await db.task.findFirst({
      where: {
        title: task.title,
        userId: task.userId ?? undefined,
        dueAt: nextDue,
        recurrenceType: task.recurrenceType,
        recurrenceInterval: task.recurrenceInterval,
        recurrenceCount: task.recurrenceCount ?? undefined,
        recurrenceUntil: task.recurrenceUntil ?? undefined,
      },
    });
    if (!existing) {
      await db.task.create({
        data: {
          title: task.title,
          subject: task.subject,
          notes: task.notes,
          priority: task.priority,
          dueAt: nextDue,
          userId: task.userId ?? undefined,
          projectId: task.projectId ?? undefined,
          courseId: task.courseId ?? undefined,
          recurrenceType: task.recurrenceType,
          recurrenceInterval: task.recurrenceInterval,
          recurrenceCount: task.recurrenceCount ?? undefined,
          recurrenceUntil: task.recurrenceUntil ?? undefined,
        },
      });
    }
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function scheduleRecurringTasks() {
  const run = () =>
    generateRecurringTasks().catch((err) =>
      console.error('recurrence job failed', err)
    );
  run();
  setInterval(run, DAY_MS);
}

if (require.main === module) {
  scheduleRecurringTasks();
}
