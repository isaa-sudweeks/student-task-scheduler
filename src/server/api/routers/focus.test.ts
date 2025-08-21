import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  updateMany: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  db: {
    taskTimeLog: {
      updateMany: hoisted.updateMany,
      create: hoisted.create,
      findFirst: hoisted.findFirst,
      update: hoisted.update,
    },
  },
}));

import { focusRouter } from './focus';

describe('focusRouter.start', () => {
  beforeEach(() => {
    hoisted.updateMany.mockReset();
    hoisted.create.mockReset();
  });

  it('closes open logs and creates a new one', async () => {
    hoisted.updateMany.mockResolvedValueOnce({ count: 1 });
    const fakeLog = { id: '1', taskId: 't1', startedAt: new Date(), endedAt: null };
    hoisted.create.mockResolvedValueOnce(fakeLog);

    const result = await focusRouter.createCaller({}).start({ taskId: 't1' });

    expect(hoisted.updateMany).toHaveBeenCalledWith({
      where: { endedAt: null },
      data: { endedAt: expect.any(Date) },
    });
    expect(hoisted.create).toHaveBeenCalledWith({
      data: { taskId: 't1', startedAt: expect.any(Date), endedAt: null },
    });
    expect(result).toEqual(fakeLog);
  });
});

describe('focusRouter.stop', () => {
  beforeEach(() => {
    hoisted.findFirst.mockReset();
    hoisted.update.mockReset();
  });

  it('finalizes an open log', async () => {
    hoisted.findFirst.mockResolvedValueOnce({ id: 'log1' });
    hoisted.update.mockResolvedValueOnce({});

    const result = await focusRouter.createCaller({}).stop({ taskId: 't1' });

    expect(hoisted.update).toHaveBeenCalledWith({
      where: { id: 'log1' },
      data: { endedAt: expect.any(Date) },
    });
    expect(result).toEqual({ ok: true });
  });

  it('returns ok when no open log exists', async () => {
    hoisted.findFirst.mockResolvedValueOnce(null);

    const result = await focusRouter.createCaller({}).stop({ taskId: 't1' });

    expect(hoisted.update).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });
});

