import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

const hoisted = vi.hoisted(() => {
  return {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    eventFindFirst: vi.fn(),
    taskFindFirst: vi.fn(),
    taskCreate: vi.fn(),
    userFindUnique: vi.fn(),
    accountFindFirst: vi.fn(),
  };
});

const googleMock = vi.hoisted(() => {
  return {
    OAuth2: vi.fn().mockReturnValue({ setCredentials: vi.fn() }),
    list: vi.fn().mockResolvedValue({
      data: {
        items: [
          {
            id: 'g1',
            summary: 'GEvent',
            start: { dateTime: '2023-01-01T00:00:00.000Z' },
            end: { dateTime: '2023-01-01T01:00:00.000Z' },
          },
        ],
      },
    }),
    insert: vi.fn().mockResolvedValue({}),
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
    task: { findFirst: hoisted.taskFindFirst, create: hoisted.taskCreate },
    user: { findUnique: hoisted.userFindUnique },
    account: { findFirst: hoisted.accountFindFirst },
  },
}));

vi.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: googleMock.OAuth2 },
    calendar: () => ({ events: { list: googleMock.list, insert: googleMock.insert } }),
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
    hoisted.taskFindFirst.mockResolvedValue({ id: 't1', title: 'Task' });
    hoisted.userFindUnique.mockReset();
    hoisted.userFindUnique.mockResolvedValue({ googleSyncEnabled: false });
    hoisted.accountFindFirst.mockReset();
    googleMock.insert.mockClear();
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
    hoisted.create.mockResolvedValueOnce({ startAt: new Date('2023-01-01T06:00:00.000Z'), endAt: new Date('2023-01-01T07:00:00.000Z') });

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
    expect(googleMock.insert).not.toHaveBeenCalled();
  });

  it('pushes events to Google when sync enabled', async () => {
    hoisted.findMany.mockResolvedValueOnce([]);
    hoisted.create.mockResolvedValueOnce({ startAt: new Date('2023-01-01T06:00:00.000Z'), endAt: new Date('2023-01-01T07:00:00.000Z') });
    hoisted.userFindUnique.mockResolvedValueOnce({ googleSyncEnabled: true });
    hoisted.accountFindFirst.mockResolvedValueOnce({ access_token: 'a', refresh_token: 'r' });

    await eventRouter.createCaller(ctx).schedule({
      taskId: 't1',
      startAt: new Date('2023-01-01T06:00:00.000Z'),
      durationMinutes: 60,
    });

    expect(googleMock.insert).toHaveBeenCalled();
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
    googleMock.insert.mockClear();
    hoisted.taskCreate.mockReset();
    hoisted.create.mockReset();
    hoisted.findMany.mockReset();
    hoisted.userFindUnique.mockReset();
    hoisted.accountFindFirst.mockReset();
  });

  it('syncs events with Google calendar', async () => {
    hoisted.userFindUnique.mockResolvedValue({ googleSyncEnabled: true });
    hoisted.accountFindFirst.mockResolvedValue({ access_token: 'a', refresh_token: 'r' });
    hoisted.taskCreate.mockResolvedValue({ id: 'nt1' });
    hoisted.create.mockResolvedValue({});
    hoisted.findMany.mockResolvedValue([
      {
        startAt: new Date('2023-01-02T00:00:00.000Z'),
        endAt: new Date('2023-01-02T01:00:00.000Z'),
        task: { title: 'Local' },
      },
    ]);

    const items = await eventRouter.createCaller(ctx).syncGoogle();
    expect(googleMock.OAuth2).toHaveBeenCalled();
    expect(googleMock.list).toHaveBeenCalled();
    expect(hoisted.taskCreate).toHaveBeenCalled();
    expect(googleMock.insert).toHaveBeenCalled();
    expect(items).toHaveLength(1);
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