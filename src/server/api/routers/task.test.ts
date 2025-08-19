import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskPriority } from '@prisma/client';

// Define hoisted fns for module mock
const hoisted = vi.hoisted(() => {
  const findMany = vi.fn().mockResolvedValue([]);
  const update = vi.fn().mockResolvedValue({});
  const create = vi.fn().mockResolvedValue({});
  const $transaction = vi.fn(async (ops: any[]) =>
    Promise.all(ops.map((op) => (typeof op === 'function' ? op() : op)))
  );
  return { findMany, update, create, $transaction };
});

vi.mock('@/server/db', () => ({
  db: {
    task: { findMany: hoisted.findMany, update: hoisted.update, create: hoisted.create },
    $transaction: hoisted.$transaction,
  },
}));

import { taskRouter } from './task';

describe('taskRouter.list ordering', () => {
  beforeEach(() => {
    hoisted.findMany.mockClear();
  });

  it('orders by priority, then position, dueAt, then createdAt', async () => {
    await taskRouter.createCaller({}).list({ filter: 'all' });
    expect(hoisted.findMany).toHaveBeenCalledTimes(1);
    const arg = hoisted.findMany.mock.calls[0][0];
    expect(arg.orderBy).toEqual([
      { priority: 'desc' },
      { position: 'asc' },
      { dueAt: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'desc' },
    ]);
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
});
