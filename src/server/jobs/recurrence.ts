import { addDays, addWeeks, addMonths } from 'date-fns';
import { db } from '@/server/db';
import { RecurrenceType, Prisma } from '@prisma/client';

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
    try {
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
    } catch (err) {
      if (
        !(err instanceof Prisma.PrismaClientKnownRequestError) ||
        err.code !== 'P2002'
      ) {
        throw err;
      }
    }
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function scheduleRecurringTasks() {
  const run = () =>
    generateRecurringTasks().catch((err) =>
      console.error('recurrence job failed', err)
    );
  let interval: NodeJS.Timeout | null = null;
  return {
    start() {
      run();
      interval = setInterval(run, DAY_MS);
      return interval;
    },
    stop() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    },
  };
}

if (require.main === module) {
  const job = scheduleRecurringTasks();
  job.start();
  process.on('SIGTERM', job.stop);
}
