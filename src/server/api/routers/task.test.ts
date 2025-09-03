import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskPriority, RecurrenceType, TaskStatus } from '@prisma/client';

// Define hoisted fns for module mock
const hoisted = vi.hoisted(() => {
  const findMany = vi.fn().mockResolvedValue([]);
  const update = vi.fn().mockResolvedValue({});
  const create = vi.fn().mockResolvedValue({});
  const updateMany = vi.fn().mockResolvedValue({ count: 0 });
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const reminderDeleteMany = vi.fn().mockResolvedValue({});
  const eventDeleteMany = vi.fn().mockResolvedValue({});
  const findFirst = vi.fn().mockResolvedValue({});
  const projectFindFirst = vi.fn().mockResolvedValue({ id: 'p1', userId: 'user1' });
  const courseFindFirst = vi.fn().mockResolvedValue({ id: 'c1', userId: 'user1' });
  const $transaction = vi.fn(async (ops: any[]) =>
    Promise.all(ops.map((op) => (typeof op === 'function' ? op() : op))),
  );
  return {
    findMany,
    update,
    create,
    updateMany,
    deleteMany,
    reminderDeleteMany,
    eventDeleteMany,
    findFirst,
    projectFindFirst,
    courseFindFirst,
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
      findFirst: hoisted.findFirst,
    },
    reminder: { deleteMany: hoisted.reminderDeleteMany },
    event: { deleteMany: hoisted.eventDeleteMany },
    project: { findFirst: hoisted.projectFindFirst },
    course: { findFirst: hoisted.courseFindFirst },
    $transaction: hoisted.$transaction,
  },
}));

import { taskRouter } from './task';
import { cache } from '@/server/cache';

const ctx = { session: { user: { id: 'user1' } } } as any;

describe('taskRouter.list ordering', () => {
  beforeEach(async () => {
    hoisted.findMany.mockClear();
    await cache.clear();
  });

  it('orders by position, then priority, dueAt, then createdAt', async () => {
    await taskRouter.createCaller(ctx).list({ filter: 'all' });
    expect(hoisted.findMany).toHaveBeenCalledTimes(1);
    const arg = hoisted.findMany.mock.calls[0][0];
    expect(arg.orderBy).toEqual([
      { position: 'asc' },
      { priority: 'desc' },
      { dueAt: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'desc' },
    ]);
    expect(arg.where).toEqual({ userId: 'user1' });
  });

  it('filters by subject when provided', async () => {
    await taskRouter.createCaller(ctx).list({ filter: 'all', subject: 'math' });
    expect(hoisted.findMany).toHaveBeenCalledTimes(1);
    const arg = hoisted.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: 'user1', subject: 'math' });
  });

  it('filters by priority when provided', async () => {
    await taskRouter.createCaller(ctx).list({ filter: 'all', priority: TaskPriority.HIGH });
    expect(hoisted.findMany).toHaveBeenCalledTimes(1);
    const arg = hoisted.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: 'user1', priority: TaskPriority.HIGH });
  });

  it('filters by courseId when provided', async () => {
    await taskRouter.createCaller(ctx).list({ filter: 'all', courseId: 'c1' });
    expect(hoisted.findMany).toHaveBeenCalledTimes(1);
    const arg = hoisted.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: 'user1', courseId: 'c1' });
  });

  it('filters by projectId when provided', async () => {
    await taskRouter.createCaller(ctx).list({ filter: 'all', projectId: 'p1' });
    expect(hoisted.findMany).toHaveBeenCalledTimes(1);
    const arg = hoisted.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: 'user1', projectId: 'p1' });
  });

  it('filters by parentId when provided', async () => {
    await taskRouter.createCaller(ctx).list({ filter: 'all', parentId: 't1' });
    expect(hoisted.findMany).toHaveBeenCalledTimes(1);
    const arg = hoisted.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: 'user1', parentId: 't1' });
  });

  it('filters by createdAt range when start and end provided', async () => {
    const start = new Date('2023-01-01T00:00:00Z');
    const end = new Date('2023-01-31T23:59:59Z');
    await taskRouter
      .createCaller(ctx)
      .list({ filter: 'all', start, end });
    const arg = hoisted.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({
      userId: 'user1',
      createdAt: { gte: start, lte: end },
    });
  });

  it('filters by status when provided', async () => {
    await taskRouter
      .createCaller(ctx)
      .list({ filter: 'all', status: TaskStatus.DONE });
    expect(hoisted.findMany).toHaveBeenCalledTimes(1);
    const arg = hoisted.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: 'user1', status: TaskStatus.DONE });
  });

  it('uses session timezone for today range when available', async () => {
    await taskRouter
      .createCaller({ session: { user: { id: 'user1', timezone: 'America/Denver' } } as any })
      .list({ filter: 'today' });
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
    expect(arg.where).toEqual({ userId: 'user1', dueAt: { gte: startUtc, lte: endUtc } });
  });
});

describe('taskRouter.list caching', () => {
  beforeEach(async () => {
    hoisted.findMany.mockClear();
    await cache.clear();
  });

  it('caches per user and invalidates only for that user on create', async () => {
    const ctx1 = { session: { user: { id: 'u1' } } } as any;
    const ctx2 = { session: { user: { id: 'u2' } } } as any;

    await taskRouter.createCaller(ctx1).list({ filter: 'all' });
    expect(hoisted.findMany).toHaveBeenCalledTimes(1);

    await taskRouter.createCaller(ctx1).list({ filter: 'all' });
    expect(hoisted.findMany).toHaveBeenCalledTimes(1);

    await taskRouter.createCaller(ctx2).list({ filter: 'all' });
    expect(hoisted.findMany).toHaveBeenCalledTimes(2);

    await taskRouter.createCaller(ctx1).create({ title: 'a' });

    await taskRouter.createCaller(ctx1).list({ filter: 'all' });
    expect(hoisted.findMany).toHaveBeenCalledTimes(3);

    await taskRouter.createCaller(ctx2).list({ filter: 'all' });
    expect(hoisted.findMany).toHaveBeenCalledTimes(3);
  });
});

describe('taskRouter.reorder', () => {
  beforeEach(() => {
    hoisted.update.mockClear();
    hoisted.$transaction.mockClear();
    hoisted.findMany.mockReset();
  });

  it('updates positions based on provided ids order', async () => {
    hoisted.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    await taskRouter.createCaller(ctx).reorder({ ids: ['a', 'b', 'c'] });
    expect(hoisted.$transaction).toHaveBeenCalledTimes(1);
    expect(hoisted.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { position: 1 } });
    expect(hoisted.update).toHaveBeenCalledWith({ where: { id: 'b' }, data: { position: 2 } });
    expect(hoisted.update).toHaveBeenCalledWith({ where: { id: 'c' }, data: { position: 3 } });
  });
});

describe('taskRouter.setStatus', () => {
  beforeEach(() => {
    hoisted.update.mockClear();
    hoisted.findFirst.mockResolvedValue({ id: '1' });
  });

  it.each(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const)(
    'updates status to %s',
    async (status) => {
      await taskRouter.createCaller(ctx).setStatus({ id: '1', status });
      expect(hoisted.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { status },
      });
    },
  );
});

describe('taskRouter.create', () => {
  beforeEach(() => {
    hoisted.create.mockClear();
  });

  it('passes priority to the database', async () => {
    await taskRouter.createCaller(ctx).create({ title: 'a', priority: TaskPriority.HIGH });
    expect(hoisted.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user1',
        priority: TaskPriority.HIGH,
        title: 'a',
        dueAt: null,
        subject: null,
        notes: null,
      }),
    });
  });

  it('passes recurrence data to the database', async () => {
    const until = new Date('2024-01-01');
    await taskRouter.createCaller(ctx).create({
      title: 'a',
      recurrenceType: RecurrenceType.DAILY,
      recurrenceInterval: 2,
      recurrenceCount: 5,
      recurrenceUntil: until,
    });
    expect(hoisted.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user1',
        recurrenceType: RecurrenceType.DAILY,
        recurrenceInterval: 2,
        recurrenceCount: 5,
        recurrenceUntil: until,
      }),
    });
  });

  it('passes project and course ids to the database', async () => {
    await taskRouter.createCaller(ctx).create({ title: 'a', projectId: 'p1', courseId: 'c1' });
    expect(hoisted.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user1',
        projectId: 'p1',
        courseId: 'c1',
        title: 'a',
        dueAt: null,
        subject: null,
        notes: null,
      }),
    });
  });

  it('passes parentId to the database', async () => {
    await taskRouter.createCaller(ctx).create({ title: 'a', parentId: 't1' });
    expect(hoisted.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user1',
        parentId: 't1',
        title: 'a',
        dueAt: null,
        subject: null,
        notes: null,
      }),
    });
  });
});

describe('taskRouter.update recurrence', () => {
  beforeEach(() => {
    hoisted.update.mockClear();
  });

  it('updates recurrence fields', async () => {
    const until = new Date('2024-02-02');
    await taskRouter.createCaller(ctx).update({
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
    await taskRouter.createCaller(ctx).update({ id: '1', projectId: 'p1', courseId: null });
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
    await taskRouter.createCaller(ctx).bulkUpdate({ ids: ['1', '2'], status: 'DONE' });
    expect(hoisted.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['1', '2'] }, userId: 'user1' },
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
    await taskRouter.createCaller(ctx).bulkDelete({ ids: ['1', '2'] });
    expect(hoisted.$transaction).toHaveBeenCalledTimes(1);
    expect(hoisted.reminderDeleteMany).toHaveBeenCalledWith({
      where: { taskId: { in: ['1', '2'] }, task: { userId: 'user1' } },
    });
    expect(hoisted.eventDeleteMany).toHaveBeenCalledWith({
      where: { taskId: { in: ['1', '2'] }, task: { userId: 'user1' } },
    });
    expect(hoisted.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['1', '2'] }, userId: 'user1' },
    });
  });
});
