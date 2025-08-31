import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const findMany = vi.fn().mockResolvedValue([]);
  const create = vi.fn().mockResolvedValue({});
  const update = vi.fn().mockResolvedValue({});
  const del = vi.fn().mockResolvedValue({});
  return { findMany, create, update, delete: del };
});

vi.mock('@/server/db', () => ({
  db: {
    course: {
      findMany: hoisted.findMany,
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
  it('lists courses for user', async () => {
    await courseRouter.createCaller(ctx).list();
    expect(hoisted.findMany).toHaveBeenCalledWith({ where: { userId: 'user1' } });
  });
});

describe('courseRouter.create', () => {
  beforeEach(() => {
    hoisted.create.mockClear();
  });
  it('creates course with title and optional fields', async () => {
    await courseRouter.createCaller(ctx).create({ title: 'c', term: 'fall', color: 'red' });
    expect(hoisted.create).toHaveBeenCalledWith({ data: { title: 'c', userId: 'user1', term: 'fall', color: 'red' } });
  });
});

describe('courseRouter.update', () => {
  beforeEach(() => {
    hoisted.update.mockClear();
  });
  it('updates course fields', async () => {
    await courseRouter.createCaller(ctx).update({ id: '1', title: 'nc', term: null, color: null });
    expect(hoisted.update).toHaveBeenCalledWith({ where: { id: '1', userId: 'user1' }, data: { title: 'nc', term: null, color: null } });
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

