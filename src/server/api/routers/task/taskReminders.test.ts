import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TRPCError } from '@trpc/server';

const hoisted = vi.hoisted(() => {
  const taskFindFirst = vi.fn().mockResolvedValue({ id: 'task-1', userId: 'user-1' });
  const reminderFindMany = vi.fn().mockResolvedValue([]);
  const reminderDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const reminderCreate = vi
    .fn()
    .mockImplementation(({ data }: { data: { taskId: string; channel: string; offsetMin: number } }) =>
      Promise.resolve({ id: `rem-${data.offsetMin}`, ...data }),
    );
  const $transaction = vi.fn(async (cb: any) =>
    cb({ reminder: { deleteMany: reminderDeleteMany, create: reminderCreate } }),
  );
  return {
    taskFindFirst,
    reminderFindMany,
    reminderDeleteMany,
    reminderCreate,
    $transaction,
  };
});

vi.mock('@prisma/client', () => ({
  ReminderChannel: {
    EMAIL: 'EMAIL',
    PUSH: 'PUSH',
    SMS: 'SMS',
  },
  TaskStatus: {
    TODO: 'TODO',
    IN_PROGRESS: 'IN_PROGRESS',
    DONE: 'DONE',
    CANCELLED: 'CANCELLED',
  },
  TaskPriority: {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
  },
  RecurrenceType: {
    NONE: 'NONE',
    DAILY: 'DAILY',
    WEEKLY: 'WEEKLY',
    MONTHLY: 'MONTHLY',
  },
}));

vi.mock('@/server/db', () => ({
  db: {
    task: { findFirst: hoisted.taskFindFirst },
    reminder: {
      findMany: hoisted.reminderFindMany,
    },
    $transaction: hoisted.$transaction,
  },
}));

import { taskRouter } from './index';

const ctx = { session: { user: { id: 'user-1' } } } as any;

describe('taskRouter reminders', () => {
  beforeEach(() => {
    hoisted.taskFindFirst.mockClear();
    hoisted.reminderFindMany.mockClear();
    hoisted.reminderDeleteMany.mockClear();
    hoisted.reminderCreate.mockClear();
    hoisted.$transaction.mockClear();
    hoisted.taskFindFirst.mockResolvedValue({ id: 'task-1', userId: 'user-1' });
  });

  it('lists reminders after verifying ownership', async () => {
    hoisted.reminderFindMany.mockResolvedValueOnce([
      { id: 'r1', taskId: 'task-1', channel: 'EMAIL', offsetMin: 30 },
    ]);
    const result = await taskRouter
      .createCaller(ctx)
      .listReminders({ taskId: 'task-1' });

    expect(hoisted.taskFindFirst).toHaveBeenCalledWith({
      where: { id: 'task-1', userId: 'user-1' },
      select: { id: true },
    });
    expect(hoisted.reminderFindMany).toHaveBeenCalledWith({
      where: { taskId: 'task-1' },
      orderBy: { offsetMin: 'asc' },
    });
    expect(result).toEqual([{ id: 'r1', taskId: 'task-1', channel: 'EMAIL', offsetMin: 30 }]);
  });

  it('throws when task does not belong to user', async () => {
    hoisted.taskFindFirst.mockResolvedValueOnce(null);
    await expect(
      taskRouter.createCaller(ctx).listReminders({ taskId: 'not-owned' }),
    ).rejects.toThrowError(TRPCError);
  });

  it('replaces reminders atomically', async () => {
    await taskRouter.createCaller(ctx).replaceReminders({
      taskId: 'task-1',
      reminders: [
        { channel: 'EMAIL', offsetMin: 15 },
        { channel: 'PUSH', offsetMin: 5 },
      ],
    });

    expect(hoisted.$transaction).toHaveBeenCalledTimes(1);
    expect(hoisted.reminderDeleteMany).toHaveBeenCalledWith({ where: { taskId: 'task-1' } });
    expect(hoisted.reminderCreate).toHaveBeenCalledTimes(2);
    expect(hoisted.reminderCreate).toHaveBeenCalledWith({
      data: { taskId: 'task-1', channel: 'EMAIL', offsetMin: 15 },
    });
    expect(hoisted.reminderCreate).toHaveBeenCalledWith({
      data: { taskId: 'task-1', channel: 'PUSH', offsetMin: 5 },
    });
  });

  it('validates offset bounds', async () => {
    await expect(
      taskRouter.createCaller(ctx).replaceReminders({
        taskId: 'task-1',
        reminders: [{ channel: 'EMAIL', offsetMin: -5 } as any],
      }),
    ).rejects.toThrowError();
  });

  it('limits the number of reminders', async () => {
    const reminders = Array.from({ length: 6 }, () => ({ channel: 'EMAIL', offsetMin: 5 }));
    await expect(
      taskRouter.createCaller(ctx).replaceReminders({ taskId: 'task-1', reminders }),
    ).rejects.toThrowError(TRPCError);
  });
});
