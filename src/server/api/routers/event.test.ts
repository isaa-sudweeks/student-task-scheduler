import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

const hoisted = vi.hoisted(() => {
  return {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
});

vi.mock('@/server/db', () => ({
  db: {
    event: {
      findMany: hoisted.findMany,
      create: hoisted.create,
      update: hoisted.update,
    },
  },
}));

import { eventRouter } from './event';

describe('eventRouter.schedule', () => {
  beforeEach(() => {
    hoisted.findMany.mockReset();
    hoisted.create.mockReset();
  });

  it('rejects overlapping times', async () => {
    hoisted.findMany.mockResolvedValueOnce([
      { startAt: new Date('2023-01-01T08:00:00.000Z'), endAt: new Date('2023-01-01T18:00:00.000Z') },
    ]);

    await expect(
      eventRouter.createCaller({}).schedule({
        taskId: 't1',
        startAt: new Date('2023-01-01T09:00:00.000Z'),
        durationMinutes: 60,
      })
    ).rejects.toThrow(TRPCError);

    expect(hoisted.create).not.toHaveBeenCalled();
  });
});

describe('eventRouter.move', () => {
  beforeEach(() => {
    hoisted.findMany.mockReset();
    hoisted.update.mockReset();
  });

  it('reschedules to the next available slot when overlaps occur', async () => {
    hoisted.findMany.mockResolvedValueOnce([
      { id: 'e2', startAt: new Date('2023-01-01T09:00:00.000Z'), endAt: new Date('2023-01-01T10:00:00.000Z') },
    ]);
    hoisted.update.mockResolvedValueOnce({});

    await eventRouter.createCaller({}).move({
      eventId: 'e1',
      startAt: new Date('2023-01-01T09:00:00.000Z'),
      endAt: new Date('2023-01-01T10:00:00.000Z'),
    });

    expect(hoisted.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: {
        startAt: new Date('2023-01-01T10:00:00.000Z'),
        endAt: new Date('2023-01-01T11:00:00.000Z'),
      },
    });
  });
});

