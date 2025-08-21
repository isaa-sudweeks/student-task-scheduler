import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { db } from '@/server/db';

export const courseRouter = router({
  list: publicProcedure.query(async () => {
    return db.course.findMany();
  }),
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        term: z.string().max(100).optional(),
        color: z.string().max(50).optional(),
      })
    )
    .mutation(async ({ input }) => {
      return db.course.create({
        data: {
          title: input.title,
          term: input.term ?? null,
          color: input.color ?? null,
        },
      });
    }),
  update: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(200).optional(),
        term: z.string().max(100).nullable().optional(),
        color: z.string().max(50).nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (typeof value !== 'undefined') data[key] = value;
      }
      if (Object.keys(data).length === 0) {
        return db.course.findUniqueOrThrow({ where: { id } });
      }
      return db.course.update({ where: { id }, data });
    }),
  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return db.course.delete({ where: { id: input.id } });
    }),
});

export default courseRouter;
