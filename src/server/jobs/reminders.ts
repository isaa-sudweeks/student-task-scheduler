import { subMinutes } from 'date-fns';
import type { ReminderChannel } from '@prisma/client';
import {
  ReminderDeliveryStatus,
  Prisma,
} from '@prisma/client';
import { db } from '@/server/db';
import { logger } from '@/server/logger';
import { createDefaultReminderProviders } from '@/server/notifications/providers';
import type {
  ReminderDeliveryService,
  StoredPushSubscription,
} from '@/server/notifications/types';

const DEFAULT_INTERVAL_MS = 60 * 1000;
const FAILURE_RETRY_MINUTES = 15;

type ReminderProviders = Partial<Record<ReminderChannel, ReminderDeliveryService>>;

const defaultProviders = createDefaultReminderProviders();

function toStoredPushSubscription(
  value: Prisma.JsonValue | null,
): StoredPushSubscription | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.endpoint !== 'string') return null;

  const keysValue = record.keys;
  let keys: StoredPushSubscription['keys'];
  if (keysValue && typeof keysValue === 'object') {
    const keysRecord = keysValue as Record<string, unknown>;
    keys = {
      p256dh:
        typeof keysRecord.p256dh === 'string' ? keysRecord.p256dh : undefined,
      auth: typeof keysRecord.auth === 'string' ? keysRecord.auth : undefined,
    };
  }

  return { endpoint: record.endpoint, keys };
}

function formatDueDescription(dueAt: Date | null, timezone: string): string {
  if (!dueAt) return 'soon';
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(dueAt);
  } catch (error) {
    logger.warn('Failed to format due date with timezone', error);
    return dueAt.toLocaleString();
  }
}

function buildMessage(taskTitle: string, dueDescription: string): {
  subject: string;
  body: string;
} {
  const subject = `Reminder: ${taskTitle}`;
  const body = `Your task "${taskTitle}" is due ${dueDescription}.`;
  return { subject, body };
}

function shouldRetryFailure(lastAttemptAt: Date | null, now: Date) {
  if (!lastAttemptAt) return true;
  const retryAfter = subMinutes(now, FAILURE_RETRY_MINUTES);
  return lastAttemptAt <= retryAfter;
}

export async function dispatchPendingReminders(
  now = new Date(),
  providers: ReminderProviders = defaultProviders,
) {
  const reminders = await db.reminder.findMany({
    where: {
      task: {
        dueAt: { not: null },
      },
    },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          notes: true,
          dueAt: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              timezone: true,
              smsNumber: true,
              pushSubscription: true,
            },
          },
        },
      },
    },
  });

  for (const reminder of reminders) {
    const task = reminder.task;
    const user = task?.user;
    if (!task?.dueAt || !user) continue;

    const reminderTime = subMinutes(task.dueAt, reminder.offsetMin);
    if (reminderTime > now) continue;

    if (
      reminder.lastStatus === ReminderDeliveryStatus.SENT &&
      reminder.lastSentAt &&
      reminder.lastSentAt >= reminderTime
    ) {
      continue;
    }

    if (
      reminder.lastStatus === ReminderDeliveryStatus.FAILED &&
      !shouldRetryFailure(reminder.lastAttemptAt, now)
    ) {
      continue;
    }

    const provider = providers[reminder.channel];
    const attemptTime = now;

    if (!provider) {
      await db.reminder.update({
        where: { id: reminder.id },
        data: {
          attemptCount: { increment: 1 },
          lastAttemptAt: attemptTime,
          lastStatus: ReminderDeliveryStatus.FAILED,
          lastError: `No delivery provider configured for channel ${reminder.channel}.`,
        },
      });
      continue;
    }

    const dueDescription = formatDueDescription(task.dueAt, user.timezone);
    const message = buildMessage(task.title, dueDescription);
    const context = {
      reminderId: reminder.id,
      channel: reminder.channel,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        timezone: user.timezone,
        smsNumber: user.smsNumber ?? null,
        pushSubscription: toStoredPushSubscription(user.pushSubscription),
      },
      task: {
        id: task.id,
        title: task.title,
        notes: task.notes,
        dueAt: task.dueAt,
      },
      message,
    };

    let result: Awaited<ReturnType<ReminderDeliveryService['send']>>;
    try {
      result = await provider.send(context);
    } catch (error) {
      logger.error('Reminder provider threw an error', error);
      result = {
        status: ReminderDeliveryStatus.FAILED,
        error:
          error instanceof Error ? error.message : 'Unknown provider error',
      };
    }

    await db.reminder.update({
      where: { id: reminder.id },
      data: {
        attemptCount: { increment: 1 },
        lastAttemptAt: attemptTime,
        lastSentAt:
          result.status === ReminderDeliveryStatus.SENT
            ? attemptTime
            : reminder.lastSentAt,
        lastStatus: result.status,
        lastError:
          result.status === ReminderDeliveryStatus.SENT
            ? null
            : result.error ?? null,
      },
    });
  }
}

export function scheduleReminderDispatch(
  providers: ReminderProviders = defaultProviders,
  intervalMs = DEFAULT_INTERVAL_MS,
) {
  const run = () =>
    dispatchPendingReminders(new Date(), providers).catch((error) =>
      logger.error('reminder dispatch job failed', error),
    );

  let interval: NodeJS.Timeout | null = null;

  return {
    start() {
      run();
      interval = setInterval(run, intervalMs);
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
  const job = scheduleReminderDispatch();
  const stop = () => job.stop();
  job.start();
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
