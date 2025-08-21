import { describe, it, expect, vi } from 'vitest';
import { userRouter } from './user';

const hoisted = vi.hoisted(() => {
  const update = vi.fn().mockResolvedValue({});
  return { update };
});

vi.mock('@/server/db', () => ({
  db: { user: { update: hoisted.update } },
}));

describe('userRouter.setTimezone', () => {
  it('updates timezone for authenticated user', async () => {
    await userRouter.createCaller({ session: { user: { id: 'u1' } } as any }).setTimezone({ timezone: 'UTC' });
    expect(hoisted.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { timezone: 'UTC' } });
  });

  it('throws when unauthenticated', async () => {
    await expect(userRouter.createCaller({}).setTimezone({ timezone: 'UTC' })).rejects.toThrow();
  });
});
