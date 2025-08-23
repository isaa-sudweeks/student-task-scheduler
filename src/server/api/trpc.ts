import { initTRPC, TRPCError } from '@trpc/server';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import superjson from 'superjson';

const rateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 10,
});

export const t = initTRPC.create({ transformer: superjson });

const rateLimit = t.middleware(async ({ ctx, next }) => {
  const ip = ctx.ip as string | undefined;
  if (!ip) return next();
  try {
    await rateLimiter.consume(ip);
    return next();
  } catch {
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS' });
  }
});

export const router = t.router;
export const publicProcedure = t.procedure.use(rateLimit);
