import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const create = vi.fn().mockResolvedValue({});
  const update = vi.fn().mockResolvedValue({});
  return { create, update };
});

vi.mock('@/server/db', () => ({
  db: {
    course: {
      findMany: vi.fn().mockResolvedValue([]),
      create: hoisted.create,
      update: hoisted.update,
      delete: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { courseRouter } from './course';

describe('courseRouter.create', () => {
  beforeEach(() => {
    hoisted.create.mockClear();
  });
  it('creates course with title and optional fields', async () => {
    await courseRouter.createCaller({}).create({ title: 'c', term: 'fall', color: 'red' });
    expect(hoisted.create).toHaveBeenCalledWith({ data: { title: 'c', userId: 'anon', term: 'fall', color: 'red' } });
  });
});

describe('courseRouter.update', () => {
  beforeEach(() => {
    hoisted.update.mockClear();
  });
  it('updates course fields', async () => {
    await courseRouter.createCaller({}).update({ id: '1', title: 'nc', term: null, color: null });
    expect(hoisted.update).toHaveBeenCalledWith({ where: { id: '1' }, data: { title: 'nc', term: null, color: null } });
  });
});
