import { describe, it, expect, vi, beforeEach } from 'vitest';

// Define hoisted fns for module mock
const hoisted = vi.hoisted(() => {
  const findMany = vi.fn().mockResolvedValue([]);
  const update = vi.fn().mockResolvedValue({});
  const $transaction = vi.fn(async (ops: any[]) =>
    Promise.all(ops.map((op) => (typeof op === 'function' ? op() : op)))
  );
  return { findMany, update, $transaction };
});

vi.mock('@/server/db', () => ({
  db: {
    task: { findMany: hoisted.findMany, update: hoisted.update },
    $transaction: hoisted.$transaction,
  },
}));

import { taskRouter } from './task';

describe('taskRouter.list ordering', () => {
  beforeEach(() => {
    hoisted.findMany.mockClear();
  });

  it('orders by position first, then dueAt, then createdAt', async () => {
    await taskRouter.createCaller({}).list({ filter: 'all' });
    expect(hoisted.findMany).toHaveBeenCalledTimes(1);
    const arg = hoisted.findMany.mock.calls[0][0];
    expect(arg.orderBy).toEqual([
      { position: 'asc' },
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
