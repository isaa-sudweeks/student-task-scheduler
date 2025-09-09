import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const hoisted = vi.hoisted(() => {
  const findMany = vi.fn();
  const create = vi.fn();
  const count = vi.fn();
  return { findMany, create, count };
});

vi.mock('@prisma/client', async () => {
  const actual = await vi.importActual<typeof import('@prisma/client')>(
    '@prisma/client'
  );
  return actual;
});

vi.mock('@/server/db', () => ({
  db: {
    task: {
      findMany: hoisted.findMany,
      create: hoisted.create,
      count: hoisted.count,
    },
  },
}));

import {
  generateRecurringTasks,
  scheduleRecurringTasks,
} from './recurrence';

const baseTemplate = {
  title: 't',
  subject: null,
  notes: null,
  priority: 'LOW',
  userId: 'u1',
  projectId: null,
  courseId: null,
  recurrenceInterval: 1,
};

describe('generateRecurringTasks', () => {
  beforeEach(() => {
    hoisted.findMany.mockReset();
    hoisted.create.mockReset();
    hoisted.count.mockReset();
  });

  it('creates next daily task', async () => {
    const now = new Date('2023-01-02T00:00:00Z');
    hoisted.findMany.mockResolvedValue([
      {
        ...baseTemplate,
        dueAt: new Date('2023-01-01T00:00:00Z'),
        recurrenceType: 'DAILY' as any,
      },
    ]);
    hoisted.create.mockResolvedValue({});
    hoisted.count.mockResolvedValue(1);

    await generateRecurringTasks(now);

    expect(hoisted.create).toHaveBeenCalledTimes(1);
    const call = hoisted.create.mock.calls[0][0];
    expect(call.data.dueAt).toEqual(new Date('2023-01-03T00:00:00Z'));
  });

  it('creates next weekly task', async () => {
    const now = new Date('2023-01-10T00:00:00Z');
    hoisted.findMany.mockResolvedValue([
      {
        ...baseTemplate,
        dueAt: new Date('2023-01-01T00:00:00Z'),
        recurrenceType: 'WEEKLY' as any,
      },
    ]);
    hoisted.create.mockResolvedValue({});
    hoisted.count.mockResolvedValue(1);

    await generateRecurringTasks(now);

    expect(hoisted.create).toHaveBeenCalledTimes(1);
    const call = hoisted.create.mock.calls[0][0];
    expect(call.data.dueAt).toEqual(new Date('2023-01-15T00:00:00Z'));
  });

  it('creates next monthly task', async () => {
    const now = new Date('2023-03-15T00:00:00Z');
    hoisted.findMany.mockResolvedValue([
      {
        ...baseTemplate,
        dueAt: new Date('2023-01-01T00:00:00Z'),
        recurrenceType: 'MONTHLY' as any,
      },
    ]);
    hoisted.create.mockResolvedValue({});
    hoisted.count.mockResolvedValue(1);

    await generateRecurringTasks(now);

    expect(hoisted.create).toHaveBeenCalledTimes(1);
    const call = hoisted.create.mock.calls[0][0];
    expect(call.data.dueAt).toEqual(new Date('2023-04-01T00:00:00Z'));
  });

  it('handles unique constraint when next already exists', async () => {
    const now = new Date('2023-01-02T00:00:00Z');
    hoisted.findMany.mockResolvedValue([
      {
        ...baseTemplate,
        dueAt: new Date('2023-01-01T00:00:00Z'),
        recurrenceType: 'DAILY' as any,
      },
    ]);
    const err = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: '4.0.0',
    });
    hoisted.create.mockRejectedValue(err);
    hoisted.count.mockResolvedValue(1);

    await expect(generateRecurringTasks(now)).resolves.toBeUndefined();

    expect(hoisted.create).toHaveBeenCalledTimes(1);
  });

  it('respects recurrenceCount limit', async () => {
    const now = new Date('2023-01-02T00:00:00Z');
    hoisted.findMany.mockResolvedValue([
      {
        ...baseTemplate,
        dueAt: new Date('2023-01-01T00:00:00Z'),
        recurrenceType: 'DAILY' as any,
        recurrenceCount: 1,
      },
    ]);
    hoisted.count.mockResolvedValue(1);

    await generateRecurringTasks(now);

    expect(hoisted.create).not.toHaveBeenCalled();
  });

  it('respects recurrenceUntil date', async () => {
    const now = new Date('2023-01-05T00:00:00Z');
    hoisted.findMany.mockResolvedValue([
      {
        ...baseTemplate,
        dueAt: new Date('2023-01-01T00:00:00Z'),
        recurrenceType: 'DAILY' as any,
        recurrenceUntil: new Date('2023-01-03T00:00:00Z'),
      },
    ]);
    hoisted.count.mockResolvedValue(1);

    await generateRecurringTasks(now);

    expect(hoisted.create).not.toHaveBeenCalled();
  });

  it('creates tasks independently for each user', async () => {
    const now = new Date('2023-01-02T00:00:00Z');
    hoisted.findMany.mockResolvedValue([
      {
        ...baseTemplate,
        userId: 'u1',
        dueAt: new Date('2023-01-01T00:00:00Z'),
        recurrenceType: 'DAILY' as any,
      },
      {
        ...baseTemplate,
        userId: 'u2',
        dueAt: new Date('2023-01-01T00:00:00Z'),
        recurrenceType: 'DAILY' as any,
      },
    ]);
    hoisted.count.mockResolvedValue(1);
    const err = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: '4.0.0',
    });
    hoisted.create.mockImplementation(({ data }) =>
      data.userId === 'u1' ? Promise.reject(err) : Promise.resolve({})
    );

    await expect(generateRecurringTasks(now)).resolves.toBeUndefined();

    expect(hoisted.create).toHaveBeenCalledTimes(2);
    const successful = hoisted.create.mock.calls.find(
      ([{ data }]) => data.userId === 'u2'
    );
    expect(successful).toBeTruthy();
  });

  it('handles concurrent executions', async () => {
    const now = new Date('2023-01-02T00:00:00Z');
    hoisted.findMany.mockResolvedValue([
      {
        ...baseTemplate,
        dueAt: new Date('2023-01-01T00:00:00Z'),
        recurrenceType: 'DAILY' as any,
      },
    ]);
    hoisted.count.mockResolvedValue(1);
    let first = true;
    const err = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: '4.0.0',
    });
    hoisted.create.mockImplementation(() =>
      first ? ((first = false), Promise.resolve({})) : Promise.reject(err)
    );

    await expect(
      Promise.all([generateRecurringTasks(now), generateRecurringTasks(now)])
    ).resolves.toEqual([undefined, undefined]);

    expect(hoisted.create).toHaveBeenCalledTimes(2);
  });
});

describe('scheduleRecurringTasks', () => {
  it('runs immediately and can be stopped', () => {
    hoisted.findMany.mockReset();
    hoisted.findMany.mockResolvedValue([]);
    vi.useFakeTimers();
    const job = scheduleRecurringTasks();
    job.start();
    expect(hoisted.findMany).toHaveBeenCalledTimes(1);
    job.stop();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(hoisted.findMany).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
