import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const create = vi.fn().mockResolvedValue({});
  const update = vi.fn().mockResolvedValue({});
  const findFirst = vi.fn().mockResolvedValue({});
  return { create, update, findFirst };
});

vi.mock('@/server/db', () => ({
  db: {
    project: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: hoisted.findFirst,
      create: hoisted.create,
      update: hoisted.update,
      delete: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { projectRouter } from './project';

describe('projectRouter.create', () => {
  beforeEach(() => {
    hoisted.create.mockClear();
  });
  it('creates project with title and description', async () => {
    await projectRouter.createCaller({ session: { user: { id: 'u1' } } as any }).create({ title: 'p', description: 'd' });
    expect(hoisted.create).toHaveBeenCalledWith({ data: { title: 'p', userId: 'u1', description: 'd' } });
  });
});

describe('projectRouter.update', () => {
  beforeEach(() => {
    hoisted.update.mockClear();
  });
  it('updates project fields', async () => {
    await projectRouter.createCaller({}).update({ id: '1', title: 'np', description: null });
    expect(hoisted.update).toHaveBeenCalledWith({ where: { id: '1' }, data: { title: 'np', description: null } });
  });
});

describe('projectRouter.byId', () => {
  beforeEach(() => {
    hoisted.findFirst.mockClear();
  });
  it('fetches project for user', async () => {
    await projectRouter.createCaller({ session: { user: { id: 'u1' } } as any }).byId({ id: 'p1' });
    expect(hoisted.findFirst).toHaveBeenCalledWith({ where: { id: 'p1', userId: 'u1' } });
  });
});
