import { describe, it, expect } from 'vitest';
import { router, publicProcedure } from './trpc';

const testRouter = router({
  ping: publicProcedure.query(() => 'pong'),
});

// The rate limiter in trpc.ts allows 10 requests per 10 seconds.

describe('tRPC rate limiting', () => {
  it('throws TOO_MANY_REQUESTS after exceeding quota', async () => {
    const caller = testRouter.createCaller({ ip: '1.1.1.1' });
    for (let i = 0; i < 10; i++) {
      await caller.ping();
    }
    await expect(caller.ping()).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });
});
