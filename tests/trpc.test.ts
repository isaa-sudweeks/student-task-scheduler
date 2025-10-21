import { describe, expect, it } from 'vitest';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, publicProcedure, router } from '@/server/api/trpc';

describe('tRPC helpers', () => {
  const testRouter = router({
    publicHello: publicProcedure.query(() => 'hello'),
    protectedId: protectedProcedure.query(({ ctx }) => ctx.session!.user.id),
  });

  it('allows access to public procedures without a session', async () => {
    const caller = testRouter.createCaller({ session: null });
    await expect(caller.publicHello()).resolves.toBe('hello');
  });

  it('throws when a protected procedure is called without authentication', async () => {
    const caller = testRouter.createCaller({ session: null });
    await expect(caller.protectedId()).rejects.toBeInstanceOf(TRPCError);
  });

  it('narrows the context when a session is present', async () => {
    const caller = testRouter.createCaller({ session: { user: { id: 'user-1', timezone: 'UTC' } } });
    await expect(caller.protectedId()).resolves.toBe('user-1');
  });
});
