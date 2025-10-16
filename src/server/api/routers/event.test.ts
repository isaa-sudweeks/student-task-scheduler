import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

const hoisted = vi.hoisted(() => {
  return {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    eventFindFirst: vi.fn(),
    taskFindFirst: vi.fn(),
    taskCreate: vi.fn(),
    taskUpdate: vi.fn(),
    userFindUnique: vi.fn(),
    accountFindFirst: vi.fn(),
  };
});

const googleMock = vi.hoisted(() => {
  return {
    OAuth2: vi.fn().mockReturnValue({ setCredentials: vi.fn() }),
    list: vi.fn(),
    insert: vi.fn().mockResolvedValue({}),
  };
});

vi.mock('@/server/db', () => ({
  db: {
    event: {
      findMany: hoisted.findMany,
      create: hoisted.create,
      update: hoisted.update,
      deleteMany: hoisted.deleteMany,
      findFirst: hoisted.eventFindFirst,
    },
    task: { findFirst: hoisted.taskFindFirst, create: hoisted.taskCreate, update: hoisted.taskUpdate },
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
    const created = {
      startAt: new Date('2023-01-01T08:00:00.000Z'),
      endAt: new Date('2023-01-01T09:00:00.000Z'),
      googleEventId: 'gid1',
    };
    hoisted.create.mockResolvedValueOnce(created as any);
    hoisted.userFindUnique.mockResolvedValueOnce({ googleSyncEnabled: true });
    hoisted.accountFindFirst.mockResolvedValueOnce({ access_token: 'a', refresh_token: 'r' });
    googleMock.insert.mockResolvedValueOnce({ data: { id: 'gid1' } });

    const result = await eventRouter.createCaller(ctx).schedule({
      taskId: 't1',
      startAt: new Date('2023-01-01T06:00:00.000Z'),
      durationMinutes: 60,
    });

    expect(googleMock.insert).toHaveBeenCalled();
    expect(hoisted.create).toHaveBeenCalledWith({
      data: {
        taskId: 't1',
        startAt: new Date('2023-01-01T08:00:00.000Z'),
        endAt: new Date('2023-01-01T09:00:00.000Z'),
        googleEventId: 'gid1',
      },
    });
    expect(result.googleSyncWarning).toBe(false);
    expect(result.event).toEqual(created);
  });

  it('continues when Google sync fails', async () => {
    hoisted.findMany.mockResolvedValueOnce([]);
    const created = {
      id: 'local-event',
      startAt: new Date('2023-01-01T08:00:00.000Z'),
      endAt: new Date('2023-01-01T09:00:00.000Z'),
      googleEventId: null,
    };
    hoisted.create.mockResolvedValueOnce(created as any);
    hoisted.userFindUnique.mockResolvedValueOnce({ googleSyncEnabled: true });
    hoisted.accountFindFirst.mockResolvedValueOnce({ access_token: 'a', refresh_token: 'r' });
    const syncError = new Error('google down');
    googleMock.insert.mockRejectedValueOnce(syncError);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await eventRouter.createCaller(ctx).schedule({
      taskId: 't1',
      startAt: new Date('2023-01-01T06:00:00.000Z'),
      durationMinutes: 60,
    });

    expect(googleMock.insert).toHaveBeenCalled();
    expect(result.googleSyncWarning).toBe(true);
    expect(result.event).toEqual(created);
    expect(hoisted.create).toHaveBeenCalledWith({
      data: {
        taskId: 't1',
        startAt: new Date('2023-01-01T08:00:00.000Z'),
        endAt: new Date('2023-01-01T09:00:00.000Z'),
      },
    });
    expect(errorSpy).toHaveBeenCalledWith('Failed to sync with Google Calendar', syncError);

    errorSpy.mockRestore();
  });

  it('rejects events that span across midnight', async () => {
    hoisted.findMany.mockResolvedValueOnce([
      {
        startAt: new Date('2023-01-01T23:00:00.000Z'),
        endAt: new Date('2023-01-03T01:00:00.000Z'),
      },
    ]);

    await expect(
      eventRouter.createCaller(ctx).schedule({
        taskId: 't1',
        startAt: new Date('2023-01-02T09:00:00.000Z'),
        durationMinutes: 60,
      }),
    ).rejects.toThrow(TRPCError);

    const sameDayStart = new Date('2023-01-02T00:00:00.000Z');
    const sameDayEnd = new Date('2023-01-02T23:59:59.999Z');
    expect(hoisted.findMany).toHaveBeenCalledWith({
      where: {
        task: { userId: ctx.session.user.id },
        AND: { startAt: { lt: sameDayEnd }, endAt: { gt: sameDayStart } },
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

  it('escapes commas, semicolons, and newlines', async () => {
    hoisted.findMany.mockResolvedValueOnce([
      {
        id: 'e1',
        startAt: new Date('2023-01-01T10:00:00.000Z'),
        endAt: new Date('2023-01-01T11:00:00.000Z'),
        location: 'Room 1, Building; A\nSecond Line',
        task: { title: 'Title, part; more\nLine' },
      },
    ]);

    const ics = await eventRouter.createCaller(ctx).ical();
    expect(ics).toContain('SUMMARY:Title\\, part\\; more\\nLine');
    expect(ics).toContain('LOCATION:Room 1\\, Building\\; A\\nSecond Line');
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
    hoisted.eventFindFirst.mockReset();
    hoisted.update.mockReset();
    hoisted.taskUpdate.mockReset();
    hoisted.deleteMany.mockReset();
  });

  it('syncs events with Google calendar without duplication', async () => {
    hoisted.userFindUnique.mockResolvedValue({ googleSyncEnabled: true });
    hoisted.accountFindFirst.mockResolvedValue({ access_token: 'a', refresh_token: 'r' });
    hoisted.eventFindFirst.mockResolvedValueOnce({ id: 'e1', taskId: 't1', task: { id: 't1', title: 'Old' } });
    hoisted.eventFindFirst.mockResolvedValueOnce(null);
    hoisted.taskCreate.mockResolvedValueOnce({ id: 't2' });
    hoisted.create.mockResolvedValueOnce({});
    hoisted.findMany.mockResolvedValueOnce([
      {
        id: 'e3',
        startAt: new Date('2023-01-02T00:00:00.000Z'),
        endAt: new Date('2023-01-02T01:00:00.000Z'),
        googleEventId: null,
        task: { title: 'Local' },
      },
    ]);
    hoisted.update.mockResolvedValue({});
    hoisted.taskUpdate.mockResolvedValue({});
    googleMock.list
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: 'g1',
              summary: 'GEvent',
              start: { dateTime: '2023-01-01T00:00:00.000Z' },
              end: { dateTime: '2023-01-01T01:00:00.000Z' },
            },
          ],
          nextPageToken: 'tok',
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: 'g2',
              summary: 'GEvent2',
              start: { dateTime: '2023-01-03T00:00:00.000Z' },
              end: { dateTime: '2023-01-03T01:00:00.000Z' },
            },
          ],
        },
      });
    googleMock.insert.mockResolvedValue({ data: { id: 'gid2' } });

    const ids = await eventRouter.createCaller(ctx).syncGoogle();
    expect(googleMock.list).toHaveBeenCalledTimes(2);
    expect(hoisted.taskCreate).toHaveBeenCalledTimes(1);
    expect(hoisted.create).toHaveBeenCalledTimes(1);
    expect(googleMock.insert).toHaveBeenCalledTimes(1);
    expect(hoisted.update).toHaveBeenCalled();
    expect(ids).toEqual(['g1', 'g2', 'gid2']);
    expect(hoisted.deleteMany).toHaveBeenCalledWith({
      where: {
        task: { userId: ctx.session.user.id },
        googleEventId: { notIn: ['g1', 'g2', 'gid2'], not: null },
      },
    });
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

  it('fails to move when another event spans midnight', async () => {
    hoisted.findMany.mockResolvedValueOnce([
      {
        id: 'e2',
        startAt: new Date('2023-01-01T23:00:00.000Z'),
        endAt: new Date('2023-01-03T01:00:00.000Z'),
      },
    ]);

    await expect(
      eventRouter.createCaller(ctx).move({
        eventId: 'e1',
        startAt: new Date('2023-01-02T09:00:00.000Z'),
        endAt: new Date('2023-01-02T10:00:00.000Z'),
      }),
    ).rejects.toThrow(TRPCError);

    expect(hoisted.update).not.toHaveBeenCalled();

    const sameDayStart = new Date('2023-01-02T00:00:00.000Z');
    const sameDayEnd = new Date('2023-01-02T23:59:59.999Z');
    expect(hoisted.findMany).toHaveBeenCalledWith({
      where: {
        task: { userId: ctx.session.user.id },
        id: { not: 'e1' },
        AND: { startAt: { lt: sameDayEnd }, endAt: { gt: sameDayStart } },
      },
    });
  });
});
