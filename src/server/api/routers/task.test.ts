import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskStatus } from '@prisma/client';
import { taskRouter } from './task';

// In-memory store to simulate DB
type T = { id: string; title: string; createdAt: Date; dueAt?: Date | null; status: TaskStatus };
let store: T[] = [];
let idSeq = 0;

// Mock the Prisma db module
vi.mock('@/server/db', () => {
  return {
    db: {
      task: {
        findMany: vi.fn(
          async (
            args?: {
              where?: { dueAt?: { lt?: Date; gte?: Date; lt2?: never; lte?: Date } | null };
              orderBy?: any;
              select?: any;
            }
          ) => {
            let result = [...store];
            // Very light filtering for tests
            const where = args?.where;
            if (where?.dueAt && (where.dueAt.lt || where.dueAt.gte || where.dueAt.lte)) {
              result = result.filter((t) => {
                const d = t.dueAt ?? null;
                if (d === null) return false; // emulate where on non-null when filtering by dueAt
                if (where.dueAt?.lt && !(d < where.dueAt.lt)) return false;
                if (where.dueAt?.gte && !(d >= where.dueAt.gte)) return false;
                if (where.dueAt?.lte && !(d <= where.dueAt.lte)) return false;
                return true;
              });
            }
            // Very light ordering: dueAt asc (nulls last), then createdAt desc
            result.sort((a, b) => {
              const ad = a.dueAt ?? null;
              const bd = b.dueAt ?? null;
              if (ad === null && bd === null) {
                return b.createdAt.getTime() - a.createdAt.getTime();
              }
              if (ad === null) return 1;
              if (bd === null) return -1;
              const cmp = ad.getTime() - bd.getTime();
              if (cmp !== 0) return cmp;
              return b.createdAt.getTime() - a.createdAt.getTime();
            });
            return result.map((t) => ({
              id: t.id,
              title: t.title,
              createdAt: t.createdAt,
              dueAt: t.dueAt ?? null,
              status: t.status,
            }));
          }
        ),
        create: vi.fn(
          async ({ data }: { data: { title: string; dueAt?: Date | null } }) => {
            const item: T = {
              id: `t_${++idSeq}`,
              title: data.title,
              createdAt: new Date(),
              dueAt: data.dueAt ?? null,
              status: TaskStatus.TODO,
            };
            store.push(item);
            return item;
          }
        ),
        update: vi.fn(
          async ({ where, data }: { where: { id: string }; data: Partial<T> }) => {
            const idx = store.findIndex((t) => t.id === where.id);
            if (idx === -1) throw new Error('Not found');
            store[idx] = { ...store[idx], ...data };
            return store[idx];
          }
        ),
        delete: vi.fn(async ({ where }: { where: { id: string } }) => {
          const idx = store.findIndex((t) => t.id === where.id);
          if (idx !== -1) {
            const [removed] = store.splice(idx, 1);
            return removed;
          }
          throw new Error('Not found');
        }),
      },
    },
  };
});

describe('taskRouter (no auth)', () => {
  beforeEach(() => {
    store = [];
    idSeq = 0;
  });

  it('creates and lists tasks', async () => {
    const caller = taskRouter.createCaller({});
    const before = await caller.list();
    expect(before).toHaveLength(0);

    const created = await caller.create({ title: 'Write tests' });
    expect(created.title).toBe('Write tests');

    const after = await caller.list();
    expect(after).toHaveLength(1);
    expect(after[0].title).toBe('Write tests');
  });

  it('deletes a task', async () => {
    const caller = taskRouter.createCaller({});
    const created = await caller.create({ title: 'Temp' });
    const list1 = await caller.list();
    expect(list1).toHaveLength(1);

    await caller.delete({ id: created.id });
    const list2 = await caller.list();
    expect(list2).toHaveLength(0);
  });

  it('updates a task title', async () => {
    const caller = taskRouter.createCaller({});
    const created = await caller.create({ title: 'Old' });
    const updated = await caller.updateTitle({ id: created.id, title: 'New Title' });
    expect(updated.title).toBe('New Title');
    const list = await caller.list();
    expect(list[0]!.title).toBe('New Title');
  });

  it('rejects invalid titles on update', async () => {
    const caller = taskRouter.createCaller({});
    const created = await caller.create({ title: 'Valid' });
    await expect(caller.updateTitle({ id: created.id, title: '' })).rejects.toThrow();
  });

  it('sets a due date on an existing task', async () => {
    const caller = taskRouter.createCaller({});
    const created = await caller.create({ title: 'With due later' });
    expect(created.dueAt ?? null).toBeNull();

    const dueAt = new Date('2030-01-15T10:00:00.000Z');
    const updated = await caller.setDueDate({ id: created.id, dueAt });
    expect(updated.dueAt?.toISOString()).toBe(dueAt.toISOString());

    const list = await caller.list();
    expect(list[0]!.dueAt?.toISOString()).toBe(dueAt.toISOString());
  });

  it('creates a task with an initial due date', async () => {
    const caller = taskRouter.createCaller({});
    const dueAt = new Date('2031-05-20T09:30:00.000Z');
    const created = await caller.create({ title: 'With due now', dueAt });
    expect(created.dueAt?.toISOString()).toBe(dueAt.toISOString());

    const list = await caller.list();
    expect(list[0]!.dueAt?.toISOString()).toBe(dueAt.toISOString());
  });

  it('clears a due date (set to null)', async () => {
    const caller = taskRouter.createCaller({});
    const dueAt = new Date('2032-03-03T00:00:00.000Z');
    const created = await caller.create({ title: 'Clear me', dueAt });
    expect(created.dueAt).toBeTruthy();
    const cleared = await caller.setDueDate({ id: created.id, dueAt: null });
    expect(cleared.dueAt ?? null).toBeNull();
  });

  it('sets task status', async () => {
    const caller = taskRouter.createCaller({});
    const created = await caller.create({ title: 'Status me' });
    expect(created.status).toBe(TaskStatus.TODO);
    const updated = await caller.setStatus({ id: created.id, status: TaskStatus.DONE });
    expect(updated.status).toBe(TaskStatus.DONE);
    const list = await caller.list();
    expect(list[0]!.status).toBe(TaskStatus.DONE);
  });

  it('rejects past due dates on create and update', async () => {
    const caller = taskRouter.createCaller({});
    const past = new Date(Date.now() - 24*60*60*1000);
    await expect(caller.create({ title: 'Past', dueAt: past })).rejects.toThrow();
    const created = await caller.create({ title: 'OK' });
    await expect(caller.setDueDate({ id: created.id, dueAt: past })).rejects.toThrow();
  });

  it('filters overdue and today correctly', async () => {
    const caller = taskRouter.createCaller({});
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24*60*60*1000);
    const endOfToday = new Date(now);
    endOfToday.setHours(23,59,0,0);
    const tomorrow = new Date(now.getTime() + 24*60*60*1000);

    const over = await caller.create({ title: 'Overdue', dueAt: tomorrow });
    const todayTask = await caller.create({ title: 'Today', dueAt: endOfToday });
    await caller.create({ title: 'Future', dueAt: new Date(now.getTime() + 2*24*60*60*1000) });

    // Simulate time passing: mark one as overdue by mutating the in-memory store
    const idx = store.findIndex(s=>s.id===over.id);
    if (idx !== -1) store[idx].dueAt = yesterday;

    const overdue = await caller.list({ filter: 'overdue' });
    expect(overdue.map(t=>t.title)).toEqual(['Overdue']);

    const today = await caller.list({ filter: 'today' });
    expect(today.map(t=>t.title)).toEqual(['Today']);

    const all = await caller.list();
    expect(all.length).toBe(3);
  });

  it('filters today using client timezone offset', async () => {
    const caller = taskRouter.createCaller({});
    // Simulate a client in UTC-7 (e.g., PDT) where local 20:00 is next day UTC
    const clientOffsetMin = 7 * 60; // Date.getTimezoneOffset() style (positive for UTC-7)

    // Suppose it's 01:30 UTC; client's local day is still "today"
    const nowUtc = new Date();
    // Build a due date that is 20:00 local today for the client
    const clientNow = new Date(nowUtc.getTime() - clientOffsetMin * 60 * 1000);
    const clientDue = new Date(clientNow);
    clientDue.setHours(20, 0, 0, 0); // 20:00 local
    // Convert that local time back to UTC
    const dueUtc = new Date(clientDue.getTime() + clientOffsetMin * 60 * 1000);

    await caller.create({ title: 'Client Today', dueAt: dueUtc });

    // Without passing tzOffset, server local "today" might not include it in some TZs
    const todayDefault = await caller.list({ filter: 'today' });
    // Not asserting on default since it depends on environment timezone.

    // With client offset, it must be included in today
    const todayClient = await caller.list({ filter: 'today', tzOffsetMinutes: clientOffsetMin });
    expect(todayClient.map((t) => t.title)).toContain('Client Today');
  });
});
