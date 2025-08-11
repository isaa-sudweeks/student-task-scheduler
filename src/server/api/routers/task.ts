import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { db } from '@/server/db';
export const taskRouter = router({
  // No authentication: list all tasks
  list: publicProcedure.query(async () => {
    return db.task.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, createdAt: true },
    });
  }),
  create: publicProcedure
    .input(z.object({ title: z.string().min(1).max(200) }))
    .mutation(async ({ input }) => {
      return db.task.create({ data: { title: input.title } });
    }),
  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return db.task.delete({ where: { id: input.id } });
    }),
});
