import { beforeEach, describe, expect, it, vi } from 'vitest';
import { taskRouter } from '@/server/api/routers/task';
import type { Prisma } from '@prisma/client';

vi.mock('@prisma/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@prisma/client')>();
  return actual;
});

type TaskCreateInput = Prisma.TaskCreateArgs['data'];

type TaskRecord = Required<TaskCreateInput> & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

const mockFindMany = vi.fn();
const mockCreate = vi.fn();

vi.mock('@/server/db', () => ({
  db: {
    task: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    project: { findFirst: vi.fn() },
    course: { findFirst: vi.fn() },
  },
}));

const invalidateSpy = vi.fn();

vi.mock('@/server/api/routers/task/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/api/routers/task/utils')>();
  return {
    ...actual,
    invalidateTaskListCache: (...args: unknown[]) => invalidateSpy(...args),
  };
});

describe('taskRouter.syllabusImport', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockCreate.mockReset();
    invalidateSpy.mockReset();
  });

  it('creates non-duplicate tasks while reporting skipped items', async () => {
    const now = new Date('2024-08-20T12:00:00Z');
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'existing-1',
        userId: 'user-1',
        courseId: 'course-1',
        title: 'Essay 1 Draft',
        dueAt: new Date('2025-01-15T17:00:00.000Z'),
      },
    ]);

    const createdTasks: TaskRecord[] = [];
    mockCreate.mockImplementation(async ({ data }: { data: TaskCreateInput }) => {
      const record: TaskRecord = {
        id: `created-${createdTasks.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      } as TaskRecord;
      createdTasks.push(record);
      return record;
    });

    const caller = taskRouter.createCaller({
      session: { user: { id: 'user-1', timezone: 'UTC' } },
    });

    const result = await caller.syllabusImport({
      courseId: 'course-1',
      tasks: [
        {
          title: 'Essay 1 Draft',
          dueAt: new Date('2025-01-15T17:00:00.000Z'),
          notes: 'Refine thesis statement',
        },
        {
          title: 'Lab Report 1',
          dueAt: new Date('2025-02-03T17:00:00.000Z'),
        },
      ],
      now,
    });

    expect(mockFindMany).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(createdTasks[0]?.title).toBe('Lab Report 1');
    expect(invalidateSpy).toHaveBeenCalledWith('user-1');

    expect(result.created).toHaveLength(1);
    expect(result.skipped).toEqual([
      {
        reason: 'duplicate',
        task: {
          title: 'Essay 1 Draft',
          dueAt: new Date('2025-01-15T17:00:00.000Z'),
          notes: 'Refine thesis statement',
        },
      },
    ]);
  });
});
