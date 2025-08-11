import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { db } from '@/server/db';

export const taskRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = (ctx.session.user as any).id as string;
    return db.task.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, createdAt: true },
    });
  }),
  create: protectedProcedure
    .input(z.object({ title: z.string().min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      const userId = (ctx.session.user as any).id as string;
      return db.task.create({ data: { title: input.title, userId } });
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => db.task.delete({ where: { id: input.id } })),
});
