import { z } from 'zod';
import { TaskStatus, MemberRole } from '@prisma/client';
import { protectedProcedure, router } from '../trpc';
import { db } from '@/server/db';
import { TRPCError } from '@trpc/server';
import { assertCourseMember, assertCourseOwner } from '@/server/api/permissions';

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
      const where: any = {
        members: { some: { userId } },
      };
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
            select: { dueAt: true },
            where: {
              status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
              dueAt: { not: null },
            },
            orderBy: { dueAt: 'asc' },
            take: 1,
          },
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
        },
      });
      return courses.map(({ tasks, ...c }) => ({
        ...c,
        nextDueAt: tasks[0]?.dueAt ?? null,
      }));
    }),
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        term: z.string().max(100).optional(),
        color: z.string().max(50).optional(),
        description: z.string().max(1000).optional(),
        syllabusUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const existing = await db.course.findFirst({
        where: {
          title: input.title,
          members: { some: { userId } },
        },
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
      return db.course.create({
        data: {
          ...(data as any),
          members: {
            create: {
              userId,
              role: MemberRole.OWNER,
            },
          },
        },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
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
        description: z.string().max(1000).nullable().optional(),
        syllabusUrl: z.string().url().nullable().optional(),
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
        await assertCourseMember({ userId, courseId: id });
        return db.course.findUniqueOrThrow({ where: { id } });
      }
      await assertCourseMember({
        userId,
        courseId: id,
        roles: [MemberRole.OWNER, MemberRole.EDITOR],
      });
      return db.course.update({ where: { id }, data });
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await assertCourseOwner({ userId, courseId: input.id });
      return db.course.delete({ where: { id: input.id } });
    }),
  deleteMany: protectedProcedure
    .input(z.object({ ids: z.array(z.string().min(1)) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      return db.course.deleteMany({
        where: {
          id: { in: input.ids },
          members: { some: { userId, role: MemberRole.OWNER } },
        },
      });
    }),
  members: protectedProcedure
    .input(z.object({ courseId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await assertCourseMember({ userId, courseId: input.courseId });
      return db.courseMember.findMany({
        where: { courseId: input.courseId },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { role: 'asc' },
      });
    }),
  inviteMember: protectedProcedure
    .input(
      z.object({
        courseId: z.string().min(1),
        email: z.string().email(),
        role: z.nativeEnum(MemberRole).default(MemberRole.EDITOR),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await assertCourseOwner({ userId, courseId: input.courseId });
      const target = await db.user.findUnique({
        where: { email: input.email.toLowerCase() },
      });
      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }
      if (target.id === userId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You are already a member.' });
      }
      await db.courseMember.upsert({
        where: { courseId_userId: { courseId: input.courseId, userId: target.id } },
        create: {
          courseId: input.courseId,
          userId: target.id,
          role: input.role,
        },
        update: { role: input.role },
      });
      return db.courseMember.findFirst({
        where: { courseId: input.courseId, userId: target.id },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      });
    }),
  updateMemberRole: protectedProcedure
    .input(
      z.object({
        courseId: z.string().min(1),
        userId: z.string().min(1),
        role: z.nativeEnum(MemberRole),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await assertCourseOwner({ userId, courseId: input.courseId });
      if (input.userId === userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Transfer ownership before modifying your role.',
        });
      }
      return db.courseMember.update({
        where: { courseId_userId: { courseId: input.courseId, userId: input.userId } },
        data: { role: input.role },
      });
    }),
  removeMember: protectedProcedure
    .input(
      z.object({
        courseId: z.string().min(1),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await assertCourseOwner({ userId, courseId: input.courseId });
      if (input.userId === userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Transfer ownership before removing yourself.',
        });
      }
      await db.courseMember.delete({
        where: { courseId_userId: { courseId: input.courseId, userId: input.userId } },
      });
      return { success: true };
    }),
});

export default courseRouter;
