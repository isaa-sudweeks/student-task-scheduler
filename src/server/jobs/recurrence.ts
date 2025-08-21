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
    let nextDue = task.dueAt;
    while (nextDue <= now) {
      nextDue =
        task.recurrenceType === RecurrenceType.DAILY
          ? addDays(nextDue, task.recurrenceInterval)
          : task.recurrenceType === RecurrenceType.WEEKLY
          ? addWeeks(nextDue, task.recurrenceInterval)
          : addMonths(nextDue, task.recurrenceInterval);
    }
    const existing = await db.task.findFirst({
      where: { title: task.title, dueAt: nextDue },
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
        },
      });
    }
  }
}

if (require.main === module) {
  generateRecurringTasks().finally(() => process.exit(0));
}
