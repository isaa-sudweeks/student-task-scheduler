import { describe, it, expect, beforeEach, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const findMany = vi.fn();
  const findFirst = vi.fn();
  const create = vi.fn();
  return { findMany, findFirst, create };
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
      findFirst: hoisted.findFirst,
      create: hoisted.create,
    },
  },
}));

import { generateRecurringTasks } from './recurrence';

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
    hoisted.findFirst.mockReset();
    hoisted.create.mockReset();
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
    hoisted.findFirst.mockResolvedValue(null);
    hoisted.create.mockResolvedValue({});

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
    hoisted.findFirst.mockResolvedValue(null);
    hoisted.create.mockResolvedValue({});

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
    hoisted.findFirst.mockResolvedValue(null);
    hoisted.create.mockResolvedValue({});

    await generateRecurringTasks(now);

    expect(hoisted.create).toHaveBeenCalledTimes(1);
    const call = hoisted.create.mock.calls[0][0];
    expect(call.data.dueAt).toEqual(new Date('2023-04-01T00:00:00Z'));
  });

  it('does not create task when next already exists', async () => {
    const now = new Date('2023-01-02T00:00:00Z');
    hoisted.findMany.mockResolvedValue([
      {
        ...baseTemplate,
        dueAt: new Date('2023-01-01T00:00:00Z'),
        recurrenceType: 'DAILY' as any,
      },
    ]);
    hoisted.findFirst.mockResolvedValue({ id: 'existing' });

    await generateRecurringTasks(now);
    
    expect(hoisted.create).not.toHaveBeenCalled();
  });
});
