import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

const hoisted = vi.hoisted(() => {
  return {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    eventFindFirst: vi.fn(),
    taskFindFirst: vi.fn(),
  };
});

const googleMock = vi.hoisted(() => {
  return {
    OAuth2: vi.fn().mockReturnValue({ setCredentials: vi.fn() }),
    list: vi.fn().mockResolvedValue({ data: { items: [{ id: 'g1' }] } }),
  };
});

vi.mock('@/server/db', () => ({
  db: {
    event: {
      findMany: hoisted.findMany,
      create: hoisted.create,
      update: hoisted.update,
      findFirst: hoisted.eventFindFirst,
    },
    task: { findFirst: hoisted.taskFindFirst },
  },
}));

vi.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: googleMock.OAuth2 },
    calendar: () => ({ events: { list: googleMock.list } }),
  },
}));

import { eventRouter } from './event';

const ctx = { session: { user: { id: 'user1' } } } as any;

describe('eventRouter.listRange', () => {
  beforeEach(() => {
    hoisted.findMany.mockReset();
  });

  it('returns events spanning the range', async () => {
    const events = [
      {
        id: 'e1',
        startAt: new Date('2023-01-01T08:00:00.000Z'),
        endAt: new Date('2023-01-01T12:00:00.000Z'),
      },
    ];
    hoisted.findMany.mockResolvedValueOnce(events);

    const start = new Date('2023-01-01T09:00:00.000Z');
    const end = new Date('2023-01-01T11:00:00.000Z');
    const res = await eventRouter.createCaller(ctx).listRange({ start, end });

    expect(hoisted.findMany).toHaveBeenCalledWith({
      where: {
        AND: [{ startAt: { lt: end } }, { endAt: { gt: start } }],
        task: { userId: ctx.session.user.id },
      },
    });
    expect(res).toEqual(events);
  });
});

describe('eventRouter.schedule', () => {
  beforeEach(() => {
    hoisted.findMany.mockReset();
    hoisted.create.mockReset();
    hoisted.taskFindFirst.mockReset();
    hoisted.taskFindFirst.mockResolvedValue({ id: 't1' });
  });

  it('rejects overlapping times', async () => {
    hoisted.findMany.mockResolvedValueOnce([
      {
        startAt: new Date('2023-01-01T08:00:00.000Z'),
        endAt: new Date('2023-01-01T18:00:00.000Z'),
      },
    ]);

    await expect(
      eventRouter.createCaller(ctx).schedule({
        taskId: 't1',
        startAt: new Date('2023-01-01T09:00:00.000Z'),
        durationMinutes: 60,
      }),
    ).rejects.toThrow(TRPCError);

    expect(hoisted.create).not.toHaveBeenCalled();
  });

  it('schedules within provided day window', async () => {
    hoisted.findMany.mockResolvedValueOnce([]);
    hoisted.create.mockResolvedValueOnce({});

    await eventRouter.createCaller(ctx).schedule({
      taskId: 't1',
      startAt: new Date('2023-01-01T06:00:00.000Z'),
      durationMinutes: 60,
      dayWindowStartHour: 6,
      dayWindowEndHour: 12,
    });

    expect(hoisted.create).toHaveBeenCalledWith({
      data: {
        taskId: 't1',
        startAt: new Date('2023-01-01T06:00:00.000Z'),
        endAt: new Date('2023-01-01T07:00:00.000Z'),
      },
    });
  });
});

describe('eventRouter.ical', () => {
  beforeEach(() => {
    hoisted.findMany.mockReset();
  });

  it('generates a simple iCal feed', async () => {
    hoisted.findMany.mockResolvedValueOnce([
      {
        id: 'e1',
        startAt: new Date('2023-01-01T10:00:00.000Z'),
        endAt: new Date('2023-01-01T11:00:00.000Z'),
        location: null,
        task: { title: 'Test Event' },
      },
    ]);

    const ics = await eventRouter.createCaller(ctx).ical();
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Test Event');
  });
});

describe('eventRouter.syncGoogle', () => {
  beforeEach(() => {
    googleMock.list.mockClear();
  });

  it('fetches events from Google calendar', async () => {
    const items = await eventRouter
      .createCaller(ctx)
      .syncGoogle({ accessToken: 't' });
    expect(googleMock.OAuth2).toHaveBeenCalled();
    expect(googleMock.list).toHaveBeenCalled();
    expect(items).toEqual([{ id: 'g1' }]);
  });
});

describe('eventRouter.move', () => {
  beforeEach(() => {
    hoisted.findMany.mockReset();
    hoisted.update.mockReset();
    hoisted.eventFindFirst.mockReset();
    hoisted.eventFindFirst.mockResolvedValue({ id: 'e1' });
  });

  it('reschedules to the next available slot when overlaps occur', async () => {
    hoisted.findMany.mockResolvedValueOnce([
      {
        id: 'e2',
        startAt: new Date('2023-01-01T09:00:00.000Z'),
        endAt: new Date('2023-01-01T10:00:00.000Z'),
      },
    ]);
    hoisted.update.mockResolvedValueOnce({});

    await eventRouter.createCaller(ctx).move({
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

  it('respects custom day window when resolving overlaps', async () => {
    hoisted.findMany.mockResolvedValueOnce([
      {
        id: 'e2',
        startAt: new Date('2023-01-01T06:00:00.000Z'),
        endAt: new Date('2023-01-01T07:00:00.000Z'),
      },
    ]);
    hoisted.update.mockResolvedValueOnce({});

    await eventRouter.createCaller(ctx).move({
      eventId: 'e1',
      startAt: new Date('2023-01-01T06:30:00.000Z'),
      endAt: new Date('2023-01-01T07:30:00.000Z'),
      dayWindowStartHour: 6,
      dayWindowEndHour: 8,
    });

    expect(hoisted.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: {
        startAt: new Date('2023-01-01T07:00:00.000Z'),
        endAt: new Date('2023-01-01T08:00:00.000Z'),
      },
    });
  });
});