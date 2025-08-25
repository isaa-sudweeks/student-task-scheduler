import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskPriority, RecurrenceType } from '@prisma/client';

// Define hoisted fns for module mock
const hoisted = vi.hoisted(() => {
  const findMany = vi.fn().mockResolvedValue([]);
  const update = vi.fn().mockResolvedValue({});
  const create = vi.fn().mockResolvedValue({});
  const updateMany = vi.fn().mockResolvedValue({ count: 0 });
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const reminderDeleteMany = vi.fn().mockResolvedValue({});
  const eventDeleteMany = vi.fn().mockResolvedValue({});
  const $transaction = vi.fn(async (ops: any[]) =>
    Promise.all(ops.map((op) => (typeof op === 'function' ? op() : op)))
  );
  return {
    findMany,
    update,
    create,
    updateMany,
    deleteMany,
    reminderDeleteMany,
    eventDeleteMany,
    $transaction,
  };
});

vi.mock('@/server/db', () => ({
  db: {
    task: {
      findMany: hoisted.findMany,
      update: hoisted.update,
      create: hoisted.create,
      updateMany: hoisted.updateMany,
      deleteMany: hoisted.deleteMany,
    },
    reminder: { deleteMany: hoisted.reminderDeleteMany },
    event: { deleteMany: hoisted.eventDeleteMany },
    $transaction: hoisted.$transaction,
  },
}));

import { taskRouter } from './task';
import { cache } from '@/server/cache';

describe('taskRouter.list ordering', () => {
  beforeEach(async () => {
    hoisted.findMany.mockClear();
    await cache.clear();
  });

  it('orders by position, then priority, dueAt, then createdAt', async () => {
    await taskRouter.createCaller({}).list({ filter: 'all' });
    expect(hoisted.findMany).toHaveBeenCalledTimes(1);
    const arg = hoisted.findMany.mock.calls[0][0];
    expect(arg.orderBy).toEqual([
      { position: 'asc' },
      { priority: 'desc' },
      { dueAt: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'desc' },
    ]);
  });

  it('filters by subject when provided', async () => {
    await taskRouter.createCaller({}).list({ filter: 'all', subject: 'math' });
    expect(hoisted.findMany).toHaveBeenCalledTimes(1);
    const arg = hoisted.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ subject: 'math' });
  });

  it('filters by priority when provided', async () => {
    await taskRouter.createCaller({}).list({ filter: 'all', priority: TaskPriority.HIGH });
    expect(hoisted.findMany).toHaveBeenCalledTimes(1);
    const arg = hoisted.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ priority: TaskPriority.HIGH });
  });

  it('uses session timezone for today range when available', async () => {
    await taskRouter.createCaller({ session: { user: { timezone: 'America/Denver' } } as any }).list({ filter: 'today' });
    const arg = hoisted.findMany.mock.calls[0][0];
    const nowUtc = new Date();
    const tz = 'America/Denver';
    const nowTz = new Date(nowUtc.toLocaleString('en-US', { timeZone: tz }));
    const startTz = new Date(nowTz);
    startTz.setHours(0, 0, 0, 0);
    const endTz = new Date(nowTz);
    endTz.setHours(23, 59, 59, 999);
    const startUtc = new Date(startTz.toLocaleString('en-US', { timeZone: 'UTC' }));
    const endUtc = new Date(endTz.toLocaleString('en-US', { timeZone: 'UTC' }));
    expect(arg.where).toEqual({ dueAt: { gte: startUtc, lte: endUtc } });
  });
});

describe('taskRouter.list caching', () => {
  beforeEach(async () => {
    hoisted.findMany.mockClear();
    await cache.clear();
  });

  it('caches results and invalidates on create', async () => {
    await taskRouter.createCaller({}).list({ filter: 'all' });
    expect(hoisted.findMany).toHaveBeenCalledTimes(1);

    await taskRouter.createCaller({}).list({ filter: 'all' });
    expect(hoisted.findMany).toHaveBeenCalledTimes(1);

    await taskRouter.createCaller({}).create({ title: 'a' });
    await taskRouter.createCaller({}).list({ filter: 'all' });
    expect(hoisted.findMany).toHaveBeenCalledTimes(2);
  });
});

describe('taskRouter.reorder', () => {
  beforeEach(() => {
    hoisted.update.mockClear();
    hoisted.$transaction.mockClear();
  });

  it('updates positions based on provided ids order', async () => {
    await taskRouter.createCaller({}).reorder({ ids: ['a', 'b', 'c'] });
    expect(hoisted.$transaction).toHaveBeenCalledTimes(1);
    // Ensure update is called for each id with the correct index
    expect(hoisted.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { position: 0 } });
    expect(hoisted.update).toHaveBeenCalledWith({ where: { id: 'b' }, data: { position: 1 } });
    expect(hoisted.update).toHaveBeenCalledWith({ where: { id: 'c' }, data: { position: 2 } });
  });
});

describe('taskRouter.setStatus', () => {
  beforeEach(() => {
    hoisted.update.mockClear();
  });

  it.each([
    'TODO',
    'IN_PROGRESS',
    'DONE',
    'CANCELLED',
  ] as const)('updates status to %s', async (status) => {
    await taskRouter.createCaller({}).setStatus({ id: '1', status });
    expect(hoisted.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { status },
    });
  });
});

describe('taskRouter.create', () => {
  beforeEach(() => {
    hoisted.create.mockClear();
  });

  it('passes priority to the database', async () => {
    await taskRouter.createCaller({}).create({ title: 'a', priority: TaskPriority.HIGH });
    expect(hoisted.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ priority: TaskPriority.HIGH, title: 'a', dueAt: null, subject: null, notes: null }),
    });
  });

  it('passes recurrence data to the database', async () => {
      const until = new Date('2024-01-01');
      await taskRouter.createCaller({}).create({
        title: 'a',
        recurrenceType: RecurrenceType.DAILY,
        recurrenceInterval: 2,
        recurrenceCount: 5,
        recurrenceUntil: until,
      });
      expect(hoisted.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          recurrenceType: RecurrenceType.DAILY,
          recurrenceInterval: 2,
          recurrenceCount: 5,
          recurrenceUntil: until,
        }),
      });
  });

  it('passes project and course ids to the database', async () => {
    await taskRouter.createCaller({}).create({ title: 'a', projectId: 'p1', courseId: 'c1' });
    expect(hoisted.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ projectId: 'p1', courseId: 'c1', title: 'a', dueAt: null, subject: null, notes: null }),
    });
  });
});

describe('taskRouter.update recurrence', () => {
  beforeEach(() => {
    hoisted.update.mockClear();
  });

    it('updates recurrence fields', async () => {
      const until = new Date('2024-02-02');
      await taskRouter.createCaller({}).update({
        id: '1',
        recurrenceType: RecurrenceType.WEEKLY,
        recurrenceInterval: 3,
        recurrenceCount: 4,
        recurrenceUntil: until,
      });
      expect(hoisted.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          recurrenceType: RecurrenceType.WEEKLY,
          recurrenceInterval: 3,
          recurrenceCount: 4,
          recurrenceUntil: until,
        },
      });
    });
});

describe('taskRouter.update project/course', () => {
  beforeEach(() => {
    hoisted.update.mockClear();
  });

  it('updates project and course ids', async () => {
    await taskRouter.createCaller({}).update({ id: '1', projectId: 'p1', courseId: null });
    expect(hoisted.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { projectId: 'p1', courseId: null },
    });
  });
});

describe('taskRouter.bulkUpdate', () => {
  beforeEach(() => {
    hoisted.updateMany.mockClear();
  });

  it('updates status for multiple tasks', async () => {
    await taskRouter.createCaller({}).bulkUpdate({ ids: ['1', '2'], status: 'DONE' });
    expect(hoisted.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['1', '2'] } },
      data: { status: 'DONE' },
    });
  });
});

describe('taskRouter.bulkDelete', () => {
  beforeEach(() => {
    hoisted.$transaction.mockClear();
    hoisted.deleteMany.mockClear();
    hoisted.reminderDeleteMany.mockClear();
    hoisted.eventDeleteMany.mockClear();
  });

  it('deletes tasks and related data', async () => {
    await taskRouter.createCaller({}).bulkDelete({ ids: ['1', '2'] });
    expect(hoisted.$transaction).toHaveBeenCalledTimes(1);
    expect(hoisted.reminderDeleteMany).toHaveBeenCalledWith({ where: { taskId: { in: ['1', '2'] } } });
    expect(hoisted.eventDeleteMany).toHaveBeenCalledWith({ where: { taskId: { in: ['1', '2'] } } });
    expect(hoisted.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['1', '2'] } } });
  });
});
