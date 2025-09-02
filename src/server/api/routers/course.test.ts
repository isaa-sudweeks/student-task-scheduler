import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

const hoisted = vi.hoisted(() => {
  const findMany = vi.fn().mockResolvedValue([]);
  const findFirst = vi.fn().mockResolvedValue(null);
  const create = vi.fn().mockResolvedValue({});
  const update = vi.fn().mockResolvedValue({});
  const del = vi.fn().mockResolvedValue({});
  return { findMany, findFirst, create, update, delete: del };
});

vi.mock('@/server/db', () => ({
  db: {
    course: {
      findMany: hoisted.findMany,
      findFirst: hoisted.findFirst,
      create: hoisted.create,
      update: hoisted.update,
      delete: hoisted.delete,
    },
  },
}));

import { courseRouter } from './course';

const ctx = { session: { user: { id: 'user1' } } } as any;

describe('courseRouter.list', () => {
  beforeEach(() => {
    hoisted.findMany.mockClear();
  });
  it('lists courses for user with pagination', async () => {
    await courseRouter.createCaller(ctx).list({ page: 2, limit: 5 });
    expect(hoisted.findMany).toHaveBeenCalledWith({ where: { userId: 'user1' }, skip: 5, take: 5 });
  });
});

describe('courseRouter.create', () => {
  beforeEach(() => {
    hoisted.create.mockClear();
    hoisted.findFirst.mockClear();
  });
  it('creates course with title and optional fields', async () => {
    await courseRouter.createCaller(ctx).create({ title: 'c', term: 'fall', color: 'red', description: 'd' });
    expect(hoisted.create).toHaveBeenCalledWith({ data: { title: 'c', userId: 'user1', term: 'fall', color: 'red', description: 'd' } });
  });
  it('throws if course title exists', async () => {
    hoisted.findFirst.mockResolvedValueOnce({ id: '1', title: 'c' });
    await expect(
      courseRouter.createCaller(ctx).create({ title: 'c' })
    ).rejects.toThrow(TRPCError);
    expect(hoisted.create).not.toHaveBeenCalled();
    expect(hoisted.findFirst).toHaveBeenCalledWith({ where: { userId: 'user1', title: 'c' } });
  });
});

describe('courseRouter.update', () => {
  beforeEach(() => {
    hoisted.update.mockClear();
  });
  it('updates course fields', async () => {
    await courseRouter.createCaller(ctx).update({ id: '1', title: 'nc', term: null, color: null, description: null });
    expect(hoisted.update).toHaveBeenCalledWith({ where: { id: '1', userId: 'user1' }, data: { title: 'nc', term: null, color: null, description: null } });
  });
});

describe('courseRouter.delete', () => {
  beforeEach(() => {
    hoisted.delete.mockClear();
  });
  it('deletes course by id for user', async () => {
    await courseRouter.createCaller(ctx).delete({ id: '1' });
    expect(hoisted.delete).toHaveBeenCalledWith({ where: { id: '1', userId: 'user1' } });
  });
});

