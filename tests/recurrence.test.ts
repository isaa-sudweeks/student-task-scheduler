import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma, RecurrenceType } from '@prisma/client';
import * as recurrenceModule from '@/server/jobs/recurrence';

const dbMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  db: {
    task: {
      findMany: dbMocks.findMany,
      count: dbMocks.count,
      create: dbMocks.create,
    },
  },
}));

describe('generateRecurringTasks', () => {
  beforeEach(() => {
    dbMocks.findMany.mockReset();
    dbMocks.count.mockReset();
    dbMocks.create.mockReset();
  });

  it('creates the next occurrence after the provided date', async () => {
    const templateDue = new Date('2024-04-01T12:00:00Z');
    dbMocks.findMany.mockResolvedValue([
      {
        id: 'template',
        title: 'Weekly review',
        subject: null,
        notes: null,
        priority: 'MEDIUM',
        dueAt: templateDue,
        userId: 'user-1',
        projectId: null,
        courseId: null,
        recurrenceType: RecurrenceType.WEEKLY,
        recurrenceInterval: 1,
        recurrenceCount: null,
        recurrenceUntil: null,
      },
    ]);
    dbMocks.count.mockResolvedValue(0);
    dbMocks.create.mockResolvedValue({});

    await recurrenceModule.generateRecurringTasks(new Date('2024-04-08T12:00:00Z'));

    expect(dbMocks.create).toHaveBeenCalledTimes(1);
    const payload = dbMocks.create.mock.calls[0][0].data;
    expect(payload.dueAt > new Date('2024-04-08T12:00:00Z')).toBe(true);
    expect(payload.recurrenceType).toBe(RecurrenceType.WEEKLY);
  });

  it('swallows duplicate errors when creating occurrences', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicate', 'P2002');
    dbMocks.findMany.mockResolvedValue([
      {
        id: 'template',
        title: 'Daily entry',
        subject: null,
        notes: null,
        priority: 'MEDIUM',
        dueAt: new Date('2024-04-01T08:00:00Z'),
        userId: 'user-1',
        projectId: null,
        courseId: null,
        recurrenceType: RecurrenceType.DAILY,
        recurrenceInterval: 1,
        recurrenceCount: null,
        recurrenceUntil: null,
      },
    ]);
    dbMocks.count.mockResolvedValue(0);
    dbMocks.create.mockRejectedValue(error);

    await expect(
      recurrenceModule.generateRecurringTasks(new Date('2024-04-02T08:00:00Z')),
    ).resolves.toBeUndefined();
  });
});

describe('scheduleRecurringTasks', () => {
  it('runs immediately and schedules future executions', async () => {
    dbMocks.findMany.mockResolvedValue([]);
    dbMocks.count.mockResolvedValue(0);
    dbMocks.create.mockResolvedValue({});
    vi.useFakeTimers();

    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    try {
      const job = recurrenceModule.scheduleRecurringTasks();
      const interval = job.start();

      await Promise.resolve();
      expect(dbMocks.findMany).toHaveBeenCalledTimes(1);
      expect(interval).toBeInstanceOf(Object);
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 24 * 60 * 60 * 1000);

      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(dbMocks.findMany).toHaveBeenCalledTimes(2);

      job.stop();
    } finally {
      vi.useRealTimers();
      setIntervalSpy.mockRestore();
    }
  });
});
