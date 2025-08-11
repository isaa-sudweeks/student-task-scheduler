import { initTRPC, TRPCError } from '@trpc/server';
import type { Session } from 'next-auth';
import superjson from 'superjson';

type Context = {
  session: Session | null;
};

export const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { session: ctx.session } });
});
