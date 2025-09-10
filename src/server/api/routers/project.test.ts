import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const create = vi.fn().mockResolvedValue({});
  const update = vi.fn().mockResolvedValue({});
  const findFirst = vi.fn().mockResolvedValue({});
  const del = vi.fn().mockResolvedValue({});
  return { create, update, findFirst, delete: del };
});

vi.mock('@/server/db', () => ({
  db: {
    project: {
      findMany: vi.fn().mockResolvedValue([]),
      create: hoisted.create,
      update: hoisted.update,
      findFirst: hoisted.findFirst,
      delete: hoisted.delete,
      },
  },
}));

import { projectRouter } from './project';

describe('projectRouter.create', () => {
  beforeEach(() => {
    hoisted.create.mockClear();
  });
  it('creates project with title, description and instructionsUrl', async () => {
    await projectRouter
      .createCaller({ session: { user: { id: 'u1' } } as any })
      .create({ title: 'p', description: 'd', instructionsUrl: 'http://example.com/u.pdf' });
    expect(hoisted.create).toHaveBeenCalledWith({
      data: { title: 'p', userId: 'u1', description: 'd', instructionsUrl: 'http://example.com/u.pdf' },
    });
  });
});

describe('projectRouter.update', () => {
  beforeEach(() => {
    hoisted.update.mockClear();
    hoisted.findFirst.mockReset();
  });
  it('updates project fields', async () => {
    hoisted.findFirst.mockResolvedValueOnce({ id: '1', userId: 'u1' });
    await projectRouter
      .createCaller({ session: { user: { id: 'u1' } } as any })
      .update({ id: '1', title: 'np', description: null, instructionsUrl: 'http://example.com/f.pdf' });
    expect(hoisted.findFirst).toHaveBeenCalledWith({ where: { id: '1' } });
    expect(hoisted.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { title: 'np', description: null, instructionsUrl: 'http://example.com/f.pdf' },
    });
  });
  it('throws if user does not own project', async () => {
    hoisted.findFirst.mockResolvedValueOnce({ id: '1', userId: 'u2' });
    await expect(
      projectRouter
        .createCaller({ session: { user: { id: 'u1' } } as any })
        .update({ id: '1', title: 'np' })
    ).rejects.toHaveProperty('code', 'UNAUTHORIZED');
  });
});

describe('projectRouter.get', () => {
  beforeEach(() => {
    hoisted.findFirst.mockClear();
  });
  it('fetches project by id for user', async () => {
    await projectRouter.createCaller({ session: { user: { id: 'u1' } } as any }).get({ id: 'p1' });
    expect(hoisted.findFirst).toHaveBeenCalledWith({ where: { id: 'p1', userId: 'u1' } });
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

describe('projectRouter.delete', () => {
  beforeEach(() => {
    hoisted.delete.mockClear();
    hoisted.findFirst.mockReset();
  });
  it('deletes project for user', async () => {
    hoisted.findFirst.mockResolvedValueOnce({ id: 'p1', userId: 'u1' });
    await projectRouter
      .createCaller({ session: { user: { id: 'u1' } } as any })
      .delete({ id: 'p1' });
    expect(hoisted.findFirst).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(hoisted.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });
  it('throws if user does not own project', async () => {
    hoisted.findFirst.mockResolvedValueOnce({ id: 'p1', userId: 'u2' });
    await expect(
      projectRouter
        .createCaller({ session: { user: { id: 'u1' } } as any })
        .delete({ id: 'p1' })
    ).rejects.toHaveProperty('code', 'UNAUTHORIZED');
  });
});
