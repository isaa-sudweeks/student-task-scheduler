import { initTRPC, TRPCError } from '@trpc/server';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import superjson from 'superjson';

const rateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 10,
});

export type Context = {
  session?: { user?: { id?: string; timezone?: string | null } | null } | null;
  ip?: string | null;
};

export const t = initTRPC.context<Context>().create({ transformer: superjson });

const rateLimit = t.middleware(async ({ ctx, next }) => {
  const ip = (ctx.ip ?? undefined) as string | undefined;
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

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next();
});

export const protectedProcedure = t.procedure.use(rateLimit).use(isAuthed);
