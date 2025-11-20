import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReminderDeliveryStatus } from '@prisma/client';
import type { ReminderDeliveryService } from '@/server/notifications/types';
import {
  dispatchPendingReminders,
  scheduleReminderDispatch,
} from '@/server/jobs/reminders';

const SENT: ReminderDeliveryStatus = 'SENT';
const FAILED: ReminderDeliveryStatus = 'FAILED';
const PENDING: ReminderDeliveryStatus = 'PENDING';

const dbMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@prisma/client', async () => {
  const actual = await vi.importActual<typeof import('@prisma/client')>(
    '@prisma/client',
  );
  return actual;
});

vi.mock('@/server/db', () => ({
  db: {
    reminder: {
      findMany: dbMocks.findMany,
      update: dbMocks.update,
    },
  },
}));

describe('dispatchPendingReminders', () => {
  beforeEach(() => {
    dbMocks.findMany.mockReset();
    dbMocks.update.mockReset();
  });

  it('dispatches due reminders and records success', async () => {
    const send = vi
      .fn<
        Parameters<ReminderDeliveryService['send']>,
        ReturnType<ReminderDeliveryService['send']>
      >()
      .mockResolvedValue({
        status: SENT,
      });

    dbMocks.findMany.mockResolvedValue([
      {
        id: 'rem-1',
        channel: 'EMAIL',
        offsetMin: 15,
        attemptCount: 0,
        lastAttemptAt: null,
        lastSentAt: null,
        lastStatus: PENDING,
        lastError: null,
        task: {
          id: 'task-1',
          title: 'Essay draft',
          notes: null,
          dueAt: new Date('2024-05-01T18:00:00Z'),
          user: {
            id: 'user-1',
            email: 'student@example.com',
            name: 'Student',
            timezone: 'UTC',
            smsNumber: null,
            pushSubscription: null,
          },
        },
      },
    ]);

    const now = new Date('2024-05-01T17:50:00Z');
    await dispatchPendingReminders(now, { EMAIL: { send } });

    expect(send).toHaveBeenCalledTimes(1);
    expect(dbMocks.update).toHaveBeenCalledTimes(1);
    expect(dbMocks.update).toHaveBeenCalledWith({
      where: { id: 'rem-1' },
      data: expect.objectContaining({
        lastStatus: SENT,
        attemptCount: { increment: 1 },
      }),
    });
  });

  it('records provider failures and retries after the cooldown', async () => {
    const send = vi
      .fn<
        Parameters<ReminderDeliveryService['send']>,
        ReturnType<ReminderDeliveryService['send']>
      >()
      .mockResolvedValue({
        status: FAILED,
        error: 'Missing email',
      });

    const reminder = {
      id: 'rem-2',
      channel: 'EMAIL',
      offsetMin: 10,
      attemptCount: 1,
      lastAttemptAt: new Date('2024-05-01T17:30:00Z'),
      lastSentAt: null,
      lastStatus: FAILED,
      lastError: 'Missing email',
      task: {
        id: 'task-2',
        title: 'Lab report',
        notes: null,
        dueAt: new Date('2024-05-01T18:00:00Z'),
        user: {
          id: 'user-1',
          email: null,
          name: 'Student',
          timezone: 'UTC',
          smsNumber: null,
          pushSubscription: null,
        },
      },
    };

    dbMocks.findMany.mockResolvedValue([reminder]);

    const now = new Date('2024-05-01T17:45:00Z');
    await dispatchPendingReminders(now, { EMAIL: { send } });

    expect(send).not.toHaveBeenCalled();
    expect(dbMocks.update).not.toHaveBeenCalled();

    const retryTime = new Date('2024-05-01T17:50:01Z');
    dbMocks.findMany.mockResolvedValue([reminder]);
    await dispatchPendingReminders(retryTime, { EMAIL: { send } });

    expect(send).toHaveBeenCalledTimes(1);
    expect(dbMocks.update).toHaveBeenCalledWith({
      where: { id: 'rem-2' },
      data: expect.objectContaining({
        lastStatus: FAILED,
        lastError: 'Missing email',
      }),
    });
  });

  it('skips reminders scheduled in the future or already sent', async () => {
    const send = vi
      .fn<
        Parameters<ReminderDeliveryService['send']>,
        ReturnType<ReminderDeliveryService['send']>
      >()
      .mockResolvedValue({
        status: SENT,
      });

    dbMocks.findMany.mockResolvedValue([
      {
        id: 'future-reminder',
        channel: 'EMAIL',
        offsetMin: 30,
        attemptCount: 0,
        lastAttemptAt: null,
        lastSentAt: null,
        lastStatus: PENDING,
        lastError: null,
        task: {
          id: 'task-3',
          title: 'Presentation',
          notes: null,
          dueAt: new Date('2024-05-01T20:00:00Z'),
          user: {
            id: 'user-1',
            email: 'student@example.com',
            name: 'Student',
            timezone: 'UTC',
            smsNumber: null,
            pushSubscription: null,
          },
        },
      },
      {
        id: 'sent-reminder',
        channel: 'EMAIL',
        offsetMin: 15,
        attemptCount: 1,
        lastAttemptAt: new Date('2024-05-01T17:40:00Z'),
        lastSentAt: new Date('2024-05-01T17:45:00Z'),
        lastStatus: SENT,
        lastError: null,
        task: {
          id: 'task-4',
          title: 'Reading',
          notes: null,
          dueAt: new Date('2024-05-01T18:00:00Z'),
          user: {
            id: 'user-1',
            email: 'student@example.com',
            name: 'Student',
            timezone: 'UTC',
            smsNumber: null,
            pushSubscription: null,
          },
        },
      },
    ]);

    await dispatchPendingReminders(new Date('2024-05-01T17:45:00Z'), {
      EMAIL: { send },
    });

    expect(send).not.toHaveBeenCalled();
    expect(dbMocks.update).not.toHaveBeenCalled();
  });
});

describe('scheduleReminderDispatch', () => {
  it('runs immediately and schedules future executions', async () => {
    dbMocks.findMany.mockResolvedValue([]);
    dbMocks.update.mockResolvedValue({});
    vi.useFakeTimers();

    const providers = {
      EMAIL: {
        send: vi.fn<
          Parameters<ReminderDeliveryService['send']>,
          ReturnType<ReminderDeliveryService['send']>
        >(),
      },
    };
    const job = scheduleReminderDispatch(providers, 1000);

    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    try {
      job.start();
      await Promise.resolve();
      expect(dbMocks.findMany).toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1000);
      expect(dbMocks.findMany).toHaveBeenCalledTimes(2);

      job.stop();
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    } finally {
      vi.useRealTimers();
      setIntervalSpy.mockRestore();
    }
  });
});
