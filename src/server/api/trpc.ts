import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';

export type Context = {
  session?: { user?: { id?: string; timezone?: string | null } | null } | null;
  ip?: string | null;
};

export const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  // Narrow the context so downstream procedures know session is defined
  return next({
    ctx: {
      ...ctx,
      session: {
        user: {
          id: ctx.session.user.id as string,
          timezone: ctx.session.user?.timezone ?? null,
        },
      },
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);
