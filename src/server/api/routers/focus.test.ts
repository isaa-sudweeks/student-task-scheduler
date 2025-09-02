import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  updateMany: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  db: {
    taskTimeLog: {
      updateMany: hoisted.updateMany,
      create: hoisted.create,
      findFirst: hoisted.findFirst,
      update: hoisted.update,
      findMany: hoisted.findMany,
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

describe('focusRouter.aggregate', () => {
  beforeEach(() => {
    hoisted.findMany.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T03:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sums durations per task including open logs', async () => {
    hoisted.findMany.mockResolvedValueOnce([
      {
        taskId: 't1',
        startedAt: new Date('2023-01-01T01:00:00Z'),
        endedAt: new Date('2023-01-01T02:00:00Z'),
      },
      {
        taskId: 't2',
        startedAt: new Date('2023-01-01T02:00:00Z'),
        endedAt: null,
      },
    ]);

    const result = await focusRouter.createCaller({}).aggregate();

    expect(hoisted.findMany).toHaveBeenCalledWith({
      where: {
        startedAt: { lte: new Date('2023-01-01T03:00:00Z') },
        OR: [
          { endedAt: { gte: new Date(0) } },
          { endedAt: null },
        ],
      },
    });
    expect(result).toEqual([
      { taskId: 't1', durationMs: 60 * 60 * 1000 },
      { taskId: 't2', durationMs: 60 * 60 * 1000 },
    ]);
  });

  it('clips durations to provided range', async () => {
    hoisted.findMany.mockResolvedValueOnce([
      {
        taskId: 't1',
        startedAt: new Date('2023-01-01T00:00:00Z'),
        endedAt: new Date('2023-01-01T04:00:00Z'),
      },
    ]);

    const start = new Date('2023-01-01T02:00:00Z');
    const end = new Date('2023-01-01T03:00:00Z');
    const result = await focusRouter
      .createCaller({})
      .aggregate({ start, end });

    expect(hoisted.findMany).toHaveBeenCalledWith({
      where: {
        startedAt: { lte: end },
        OR: [{ endedAt: { gte: start } }, { endedAt: null }],
      },
    });
    expect(result).toEqual([{ taskId: 't1', durationMs: 60 * 60 * 1000 }]);
  });
});

