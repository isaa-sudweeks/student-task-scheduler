import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { db } from '@/server/db';
import { TRPCError } from '@trpc/server';

export const courseRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    return db.course.findMany({ where: { userId } });
  }),
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        term: z.string().max(100).optional(),
        color: z.string().max(50).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const existing = await db.course.findFirst({
        where: { userId, title: input.title },
      });
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Course already exists',
        });
      }
      return db.course.create({
        data: {
          title: input.title,
          userId,
          term: input.term ?? null,
          color: input.color ?? null,
        },
      });
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(200).optional(),
        term: z.string().max(100).nullable().optional(),
        color: z.string().max(50).nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const { id, ...rest } = input;
      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (typeof value !== 'undefined') data[key] = value;
      }
      if (Object.keys(data).length === 0) {
        return db.course.findUniqueOrThrow({ where: { id, userId } });
      }
      return db.course.update({ where: { id, userId }, data });
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      return db.course.delete({ where: { id: input.id, userId } });
    }),
});

export default courseRouter;
