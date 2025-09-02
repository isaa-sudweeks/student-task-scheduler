import { describe, it, expect } from 'vitest';
import { router, publicProcedure } from './trpc';

const testRouter = router({
  ping: publicProcedure.query(() => 'pong'),
});

describe('tRPC request handling', () => {
  it('allows repeated requests without rate limiting', async () => {
    const caller = testRouter.createCaller({ ip: '1.1.1.1' });
    for (let i = 0; i < 20; i++) {
      await expect(caller.ping()).resolves.toBe('pong');
    }
  });
});
