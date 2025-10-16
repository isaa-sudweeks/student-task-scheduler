import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TRPCError } from '@trpc/server';

const mocks = vi.hoisted(() => ({
  taskCreate: vi.fn(),
  taskUpdate: vi.fn(),
  taskFindFirst: vi.fn(),
  invalidateTaskListCache: vi.fn(),
  buildListCacheKey: vi.fn(() => 'cache-key'),
  validateRecurrence: vi.fn(),
}));

vi.mock('@/server/cache', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    deleteByPrefix: vi.fn(),
  },
}));

vi.mock('@/server/db', () => ({
  db: {
    task: {
      create: mocks.taskCreate,
      update: mocks.taskUpdate,
      findFirst: mocks.taskFindFirst,
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    reminder: {
      deleteMany: vi.fn(),
    },
    event: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('./utils', () => ({
  buildListCacheKey: mocks.buildListCacheKey,
  invalidateTaskListCache: mocks.invalidateTaskListCache,
  requireUserId: (ctx: any) => {
    const id = ctx.session?.user?.id;
    if (!id) throw new TRPCError({ code: 'UNAUTHORIZED' });
    return id;
  },
  validateRecurrence: mocks.validateRecurrence,
}));

vi.mock('./index', () => ({
  validateTaskRelationships: vi.fn(),
}));

import { taskCrudRouter } from './taskCrud';
import { invalidateTaskListCache } from './utils';
import * as taskModule from './index';

const caller = () => taskCrudRouter.createCaller({ session: { user: { id: 'user-1' } } } as any);
const validateTaskRelationships = vi.mocked(taskModule.validateTaskRelationships);

const taskCreate = mocks.taskCreate;
const taskUpdate = mocks.taskUpdate;
const taskFindFirst = mocks.taskFindFirst;
const invalidateTaskListCacheMock = vi.mocked(invalidateTaskListCache);

describe('taskCrudRouter', () => {
  beforeEach(() => {
    taskCreate.mockReset();
    taskUpdate.mockReset();
    taskFindFirst.mockReset();
    invalidateTaskListCacheMock.mockReset();
    validateTaskRelationships.mockReset();
  });

  describe('create', () => {
    it('persists effortMinutes when provided', async () => {
      const createdTask = { id: 'task-1', userId: 'user-1', effortMinutes: 45 } as any;
      taskCreate.mockResolvedValue(createdTask);
      validateTaskRelationships.mockResolvedValue(undefined);

      const result = await caller().create({ title: 'Read chapter', effortMinutes: 45 });

      expect(taskCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          title: 'Read chapter',
          effortMinutes: 45,
        }),
      });
      expect(invalidateTaskListCacheMock).toHaveBeenCalledWith('user-1');
      expect(result).toBe(createdTask);
    });

    it('rejects non-positive effortMinutes', async () => {
      validateTaskRelationships.mockResolvedValue(undefined);

      await expect(
        caller().create({ title: 'Invalid effort', effortMinutes: 0 }),
      ).rejects.toThrow();
      expect(taskCreate).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates effortMinutes and allows clearing the value', async () => {
      const existing = { id: 'task-1', userId: 'user-1', effortMinutes: 60 } as any;
      taskFindFirst.mockResolvedValue(existing);
      taskUpdate.mockResolvedValue({ ...existing, effortMinutes: null });
      validateTaskRelationships.mockResolvedValue(undefined);

      const result = await caller().update({ id: 'task-1', effortMinutes: null });

      expect(taskUpdate).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({ effortMinutes: null }),
      });
      expect(invalidateTaskListCacheMock).toHaveBeenCalledWith('user-1');
      expect(result.effortMinutes).toBeNull();
    });

    it('validates positive values on update', async () => {
      const existing = { id: 'task-2', userId: 'user-1', effortMinutes: null } as any;
      taskFindFirst.mockResolvedValue(existing);
      validateTaskRelationships.mockResolvedValue(undefined);

      await expect(
        caller().update({ id: 'task-2', effortMinutes: 0 }),
      ).rejects.toThrow();
      expect(taskUpdate).not.toHaveBeenCalled();
    });
  });
});
