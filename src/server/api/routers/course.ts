import { z } from 'zod';
import { TaskStatus } from '@prisma/client';
import { protectedProcedure, router } from '../trpc';
import { db } from '@/server/db';
import { TRPCError } from '@trpc/server';
import { calculateWeightedPercentage } from '@/lib/grades';

export const courseRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(10),
        search: z.string().optional(),
        term: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { page, limit, search, term } = input;
      const where: any = { userId };
      if (search && search.trim()) {
        where.title = { contains: search, mode: 'insensitive' };
      }
      if (term) {
        where.term = term;
      }
      const courses = await db.course.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          tasks: {
            select: {
              id: true,
              dueAt: true,
              status: true,
              gradeScore: true,
              gradeTotal: true,
              gradeWeight: true,
            },
          },
        },
      });
      return courses.map(({ tasks, ...c }) => {
        const upcoming = tasks
          .filter(
            (task) =>
              task.dueAt &&
              ![TaskStatus.DONE, TaskStatus.CANCELLED].includes(task.status),
          )
          .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime());
        const gradedEntries = tasks.filter(
          (task) =>
            typeof task.gradeScore === 'number' &&
            typeof task.gradeTotal === 'number' &&
            task.gradeTotal > 0,
        );
        const { percentage: gradeAverage, weightSum } = calculateWeightedPercentage(
          gradedEntries.map((task) => ({
            score: task.gradeScore as number,
            total: task.gradeTotal as number,
            weight: task.gradeWeight ?? undefined,
          })),
        );

        return {
          ...c,
          nextDueAt: upcoming[0]?.dueAt ?? null,
          gradeAverage,
          gradeWeightSum: weightSum,
          gradedTaskCount: gradedEntries.length,
        } as typeof c & {
          nextDueAt: Date | null;
          gradeAverage: number | null;
          gradeWeightSum: number;
          gradedTaskCount: number;
        };
      });
    }),
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        term: z.string().max(100).optional(),
        color: z.string().max(50).optional(),
        description: z.string().max(1000).optional(),
        syllabusUrl: z.string().url().optional(),
        creditHours: z.number().min(0).max(50).optional(),
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
      const data: Record<string, unknown> = {
        title: input.title,
        userId,
        term: input.term ?? null,
        color: input.color ?? null,
        description: input.description ?? null,
      };
      if (typeof input.syllabusUrl !== 'undefined') {
        (data as any).syllabusUrl = input.syllabusUrl ?? null;
      }
      if (typeof input.creditHours !== 'undefined') {
        (data as any).creditHours = input.creditHours ?? null;
      }
      return db.course.create({ data: data as any });
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(200).optional(),
        term: z.string().max(100).nullable().optional(),
        color: z.string().max(50).nullable().optional(),
        description: z.string().max(1000).nullable().optional(),
        syllabusUrl: z.string().url().nullable().optional(),
        creditHours: z.number().min(0).max(50).nullable().optional(),
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
  deleteMany: protectedProcedure
    .input(z.object({ ids: z.array(z.string().min(1)) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      return db.course.deleteMany({
        where: { id: { in: input.ids }, userId },
      });
    }),
});

export default courseRouter;
