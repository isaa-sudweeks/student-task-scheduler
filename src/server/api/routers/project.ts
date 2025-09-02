import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure, protectedProcedure, router } from '../trpc';
import { db } from '@/server/db';

export const projectRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    return db.project.findMany({ where: { userId } });
  }),
  get: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      return db.project.findFirst({ where: { id: input.id, userId } });
    }),
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
        instructionsUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return db.project.create({
        data: {
          title: input.title,
          userId,
          description: input.description ?? null,
          instructionsUrl: input.instructionsUrl ?? null,
        },
      });
    }),
  update: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(1000).nullable().optional(),
        instructionsUrl: z.string().url().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (typeof value !== 'undefined') data[key] = value;
      }
      if (Object.keys(data).length === 0) {
        return db.project.findUniqueOrThrow({ where: { id } });
      }
      return db.project.update({ where: { id }, data });
    }),
  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return db.project.delete({ where: { id: input.id } });
    }),
});

export default projectRouter;
