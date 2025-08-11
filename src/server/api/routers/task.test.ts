import { describe, it, expect, beforeEach, vi } from 'vitest';
import { taskRouter } from './task';

// In-memory store to simulate DB
type T = { id: string; title: string; createdAt: Date };
let store: T[] = [];
let idSeq = 0;

// Mock the Prisma db module
vi.mock('@/server/db', () => {
  return {
    db: {
      task: {
        findMany: vi.fn(async () =>
          store.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        ),
        create: vi.fn(async ({ data }: { data: { title: string } }) => {
          const item: T = {
            id: `t_${++idSeq}`,
            title: data.title,
            createdAt: new Date(),
          };
          store.push(item);
          return item;
        }),
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
});
