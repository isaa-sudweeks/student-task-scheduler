import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../trpc';
import { db } from '@/server/db';
import { MemberRole } from '@prisma/client';
import { assertProjectMember, assertProjectOwner } from '@/server/api/permissions';

export const projectRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    return db.project.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
      },
    });
  }),
  get: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await assertProjectMember({ userId, projectId: input.id });
      return db.project.findFirst({
        where: { id: input.id },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
        },
      });
    }),
  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await assertProjectMember({ userId, projectId: input.id });
      return db.project.findFirst({
        where: { id: input.id },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
        },
      });
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
        description: z.string().max(1000).nullable().optional(),
        instructionsUrl: z.string().url().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await assertProjectMember({
        userId,
        projectId: input.id,
        roles: [MemberRole.OWNER, MemberRole.EDITOR],
      });
      const { id, ...rest } = input;
      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (typeof value !== 'undefined') data[key] = value;
      }
      if (Object.keys(data).length === 0) {
        return db.project.findFirstOrThrow({ where: { id } });
      }
      return db.project.update({ where: { id }, data });
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await assertProjectOwner({ userId, projectId: input.id });
      return db.project.delete({ where: { id: input.id } });
    }),
  members: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await assertProjectMember({ userId, projectId: input.projectId });
      return db.projectMember.findMany({
        where: { projectId: input.projectId },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { role: 'asc' },
      });
    }),
  inviteMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        email: z.string().email(),
        role: z.nativeEnum(MemberRole).default(MemberRole.EDITOR),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await assertProjectOwner({ userId, projectId: input.projectId });
      const target = await db.user.findUnique({
        where: { email: input.email.toLowerCase() },
      });
      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }
      if (target.id === userId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You are already a member.' });
      }
      await db.projectMember.upsert({
        where: {
          projectId_userId: { projectId: input.projectId, userId: target.id },
        },
        create: {
          projectId: input.projectId,
          userId: target.id,
          role: input.role,
        },
        update: { role: input.role },
      });
      return db.projectMember.findFirst({
        where: { projectId: input.projectId, userId: target.id },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      });
    }),
  updateMemberRole: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        userId: z.string().min(1),
        role: z.nativeEnum(MemberRole),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await assertProjectOwner({ userId, projectId: input.projectId });
      if (input.userId === userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Transfer ownership before modifying your role.',
        });
      }
      return db.projectMember.update({
        where: {
          projectId_userId: { projectId: input.projectId, userId: input.userId },
        },
        data: { role: input.role },
      });
    }),
  removeMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await assertProjectOwner({ userId, projectId: input.projectId });
      if (input.userId === userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Transfer ownership before removing yourself.',
        });
      }
      await db.projectMember.delete({
        where: {
          projectId_userId: { projectId: input.projectId, userId: input.userId },
        },
      });
      return { success: true };
    }),
});

export default projectRouter;
