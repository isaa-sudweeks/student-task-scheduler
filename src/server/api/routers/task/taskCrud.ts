import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  TaskStatus,
  TaskPriority,
  Prisma,
  RecurrenceType,
  MemberRole,
} from '@prisma/client';
import type { Task } from '@prisma/client';
import { router, protectedProcedure } from '../../trpc';
import * as taskModule from './index';
import { db } from '@/server/db';
import { cache } from '@/server/cache';
import {
  buildListCacheKey,
  buildSubjectOptionsCacheKey,
  invalidateTaskListCache,
  requireUserId,
  validateRecurrence,
} from './utils';
import { computeTodayBounds } from './timezone';
import {
  parseExternalRefs,
  resolveProvidersForUser,
  syncEventDelete,
} from '@/server/calendar/sync';
import { assertTaskMember, assertTaskOwner } from '@/server/api/permissions';

export const taskCrudRouter = router({
  subjectOptions: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx);
    const cacheKey = buildSubjectOptionsCacheKey(userId);
    const cached = await cache.get<string[]>(cacheKey);
    if (cached) return cached;

    const subjects = await db.task.findMany({
      where: { members: { some: { userId } }, subject: { not: null } },
      select: { subject: true },
      distinct: ['subject'],
      orderBy: { subject: 'asc' },
    });

    const uniqueSubjects = Array.from(
      new Set(
        subjects
          .map((record) => record.subject)
          .filter((subject): subject is string => Boolean(subject)),
      ),
    ).sort((a, b) => a.localeCompare(b));

    await cache.set(cacheKey, uniqueSubjects, 300);

    return uniqueSubjects;
  }),
  list: protectedProcedure
    .input(
      z
        .object({
          filter: z.enum(['all', 'overdue', 'today', 'archive']).optional(),
          subject: z.string().optional(),
          status: z.nativeEnum(TaskStatus).optional(),
          priority: z.nativeEnum(TaskPriority).optional(),
          courseId: z.string().optional(),
          projectId: z.string().optional(),
          collaboratorId: z.string().optional(),
          parentId: z.string().nullable().optional(),
          // Minutes to add to UTC to get client local time offset (Date.getTimezoneOffset style)
          tzOffsetMinutes: z.number().int().optional(),
          // Optional explicit client-local day bounds as absolute instants
          todayStart: z.date().optional(),
          todayEnd: z.date().optional(),
          start: z.date().optional(),
          end: z.date().optional(),
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      const filter = input?.filter ?? 'all';
      const subject = input?.subject;
      const status = input?.status;
      const priority = input?.priority;
      const courseId = input?.courseId;
      const projectId = input?.projectId;
      const collaboratorId = input?.collaboratorId;
      const parentId = input?.parentId;
      const tzOffsetMinutes = input?.tzOffsetMinutes ?? null;
      const nowUtc = new Date();

      const { startUtc, endUtc } = computeTodayBounds({
        nowUtc,
        timezone: ctx.session?.user?.timezone ?? null,
        tzOffsetMinutes,
        todayStart: input?.todayStart,
        todayEnd: input?.todayEnd,
      });

      const whereConditions: Prisma.TaskWhereInput[] = [
        { members: { some: { userId } } },
      ];

      if (filter === 'archive') {
        whereConditions.push({ status: TaskStatus.DONE });
      } else if (filter === 'overdue') {
        whereConditions.push({ dueAt: { lt: nowUtc } });
      } else if (filter === 'today') {
        whereConditions.push({ dueAt: { gte: startUtc, lte: endUtc } });
      }

      if (subject) {
        whereConditions.push({ subject });
      }
      if (status) {
        whereConditions.push({ status });
      }
      if (priority) {
        whereConditions.push({ priority });
      }
      if (courseId) {
        whereConditions.push({ courseId });
      }
      if (projectId) {
        whereConditions.push({ projectId });
      }
      if (collaboratorId) {
        whereConditions.push({ members: { some: { userId: collaboratorId } } });
      }
      if (parentId !== undefined) {
        whereConditions.push({ parentId });
      }

      const start = input?.start;
      const end = input?.end;
      if (start || end) {
        whereConditions.push({
          createdAt: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lte: end } : {}),
          },
        });
      }

      const where: Prisma.TaskWhereInput = { AND: whereConditions };

      const limit = input?.limit;
      const cursor = input?.cursor;
      const dueAtOrder: Prisma.TaskOrderByWithRelationInput = {
        dueAt: { sort: 'asc', nulls: 'last' },
      };

      type TaskWithCourse = Prisma.TaskGetPayload<{ include: { course: { include: { meetings: true } } } }>;
      const cacheKey = buildListCacheKey(input, ctx.session?.user?.id ?? null);
      const cached = await cache.get<TaskWithCourse[]>(cacheKey);
      if (cached) return cached;

      const tasks = await db.task.findMany({
        where,
        include: {
          course: { include: { meetings: true } },
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
        },
        orderBy: [
          // Respect manual ordering first
          { position: 'asc' },
          // Then highest priority within the same position
          { priority: 'desc' },
          // Next sort by due date (nulls last)
          dueAtOrder,
          // Finally, newest first as a tiebreaker
          { createdAt: 'desc' },
        ],
        take: limit,
        skip: cursor ? 1 : undefined,
        cursor: cursor ? { id: cursor } : undefined,
      });
      await cache.set(cacheKey, tasks, 60);
      return tasks;
    }),
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        dueAt: z.date().nullable().optional(),
        subject: z.string().max(100).optional(),
        notes: z.string().max(2000).optional(),
        effortMinutes: z.number().int().min(1).optional(),
        priority: z.nativeEnum(TaskPriority).optional(),
        recurrenceType: z.nativeEnum(RecurrenceType).optional(),
        recurrenceInterval: z.number().int().min(1).optional(),
        recurrenceCount: z.number().int().min(1).optional(),
        recurrenceUntil: z.date().optional(),
        projectId: z.string().min(1).optional(),
        courseId: z.string().min(1).optional(),
        parentId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (input.dueAt && input.dueAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Due date cannot be in the past' });
      }
      const userId = requireUserId(ctx);
      validateRecurrence({
        recurrenceType: input.recurrenceType,
        recurrenceInterval: input.recurrenceInterval,
        recurrenceCount: input.recurrenceCount,
        recurrenceUntil: input.recurrenceUntil,
      });
      await taskModule.validateTaskRelationships(userId, {
        projectId: input.projectId,
        courseId: input.courseId,
        parentId: input.parentId,
      });
      const created = await db.task.create({
        data: {
          userId,
          title: input.title,
          dueAt: input.dueAt ?? null,
          subject: input.subject ?? null,
          notes: input.notes ?? null,
          effortMinutes: input.effortMinutes ?? undefined,
          priority: input.priority ?? undefined,
          recurrenceType: input.recurrenceType ?? undefined,
          recurrenceInterval: input.recurrenceInterval ?? undefined,
          recurrenceCount: input.recurrenceCount ?? undefined,
          recurrenceUntil: input.recurrenceUntil ?? undefined,
          projectId: input.projectId ?? undefined,
          courseId: input.courseId ?? undefined,
          parentId: input.parentId ?? undefined,
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
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
        },
      });
      await invalidateTaskListCache(userId);
      return created;
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(200).optional(),
        subject: z.string().max(100).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
        dueAt: z.date().nullable().optional(),
        effortMinutes: z.number().int().min(1).nullable().optional(),
        priority: z.nativeEnum(TaskPriority).optional(),
        recurrenceType: z.nativeEnum(RecurrenceType).optional(),
        recurrenceInterval: z.number().int().min(1).optional(),
        recurrenceCount: z.number().int().min(1).nullable().optional(),
        recurrenceUntil: z.date().nullable().optional(),
        // Disallow empty strings; allow explicit null to clear
        projectId: z.string().min(1).nullable().optional(),
        courseId: z.string().min(1).nullable().optional(),
        parentId: z.string().min(1).nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (input.dueAt && input.dueAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Due date cannot be in the past' });
      }
      validateRecurrence({
        recurrenceType: input.recurrenceType,
        recurrenceInterval: input.recurrenceInterval,
        recurrenceCount: input.recurrenceCount,
        recurrenceUntil: input.recurrenceUntil,
      });
      const { id, ...rest } = input;
      const userId = requireUserId(ctx);
      const membership = await db.taskMember.findFirst({
        where: { taskId: id, userId, role: { in: [MemberRole.OWNER, MemberRole.EDITOR] } },
        select: { role: true },
      });
      if (!membership) throw new TRPCError({ code: 'FORBIDDEN' });
      const existing = await db.task.findFirst({
        where: { id },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (typeof value !== 'undefined') data[key] = value;
      }

      await taskModule.validateTaskRelationships(userId, {
        projectId: data.projectId as string | null | undefined,
        courseId: data.courseId as string | null | undefined,
        parentId: data.parentId as string | null | undefined,
      });
      let result: Task;
      if (Object.keys(data).length === 0) {
        result = existing;
      } else {
        result = await db.task.update({ where: { id }, data: data as Prisma.TaskUpdateInput });
      }
      await invalidateTaskListCache(userId);
      return result;
    }),
  setDueDate: protectedProcedure
    .input(z.object({ id: z.string().min(1), dueAt: z.date().nullable() }))
    .mutation(async ({ input, ctx }) => {
      if (input.dueAt && input.dueAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Due date cannot be in the past' });
      }
      const userId = requireUserId(ctx);
      const membership = await db.taskMember.findFirst({
        where: {
          taskId: input.id,
          userId,
          role: { in: [MemberRole.OWNER, MemberRole.EDITOR] },
        },
      });
      if (!membership) throw new TRPCError({ code: 'FORBIDDEN' });
      const updated = await db.task.update({
        where: { id: input.id },
        data: { dueAt: input.dueAt ?? null },
      });
      await invalidateTaskListCache(userId);
      return updated;
    }),
  updateTitle: protectedProcedure
    .input(z.object({ id: z.string().min(1), title: z.string().min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      const membership = await db.taskMember.findFirst({
        where: {
          taskId: input.id,
          userId,
          role: { in: [MemberRole.OWNER, MemberRole.EDITOR] },
        },
      });
      if (!membership) throw new TRPCError({ code: 'FORBIDDEN' });
      const updated = await db.task.update({ where: { id: input.id }, data: { title: input.title } });
      await invalidateTaskListCache(userId);
      return updated;
    }),
  setStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      const membership = await db.taskMember.findFirst({
        where: {
          taskId: input.id,
          userId,
          role: { in: [MemberRole.OWNER, MemberRole.EDITOR] },
        },
      });
      if (!membership) throw new TRPCError({ code: 'FORBIDDEN' });
      const updated = await db.task.update({ where: { id: input.id }, data: { status: input.status } });
      await invalidateTaskListCache(userId);
      return updated;
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      const membership = await db.taskMember.findFirst({
        where: { taskId: input.id, userId, role: MemberRole.OWNER },
        select: { id: true },
      });
      if (!membership) throw new TRPCError({ code: 'FORBIDDEN' });

      const userSettings = await db.user.findUnique({
        where: { id: userId },
        select: { calendarSyncProviders: true, googleSyncEnabled: true },
      });
      const providers = resolveProvidersForUser(
        userSettings?.calendarSyncProviders ?? [],
        userSettings?.googleSyncEnabled ?? false,
      );
      if (providers.length > 0) {
        const events = await db.event.findMany({
          where: { taskId: input.id, task: { members: { some: { userId } } } },
        });
        for (const event of events) {
          const outcome = await syncEventDelete({
            userId,
            taskId: event.taskId,
            eventId: event.id,
            providers,
            refs: parseExternalRefs(event.externalSyncRefs),
          });
          for (const warning of outcome.warnings) {
            console.warn('Calendar sync warning during task delete', warning);
          }
        }
      }
      // Be resilient even if DB referential actions aren't cascaded yet
      const [, , deleted] = await db.$transaction([
        db.reminder.deleteMany({ where: { taskId: input.id, task: { members: { some: { userId } } } } }),
        db.event.deleteMany({ where: { taskId: input.id, task: { members: { some: { userId } } } } }),
        db.task.delete({ where: { id: input.id } }),
      ]);
      await invalidateTaskListCache(userId);
      return deleted;
    }),
  catalog: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx);
    return db.task.findMany({
      where: { members: { some: { userId } } },
      select: { id: true, title: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }),
  collaborators: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx);
    const collaborators = await db.taskMember.findMany({
      where: { task: { members: { some: { userId } } } },
      select: {
        userId: true,
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });
    const seen = new Map<string, { id: string; name: string; email: string | null; image: string | null }>();
    for (const membership of collaborators) {
      if (membership.userId === userId) continue;
      if (!membership.user) continue;
      const name = membership.user.name ?? membership.user.email ?? 'Unknown user';
      seen.set(membership.userId, {
        id: membership.userId,
        name,
        email: membership.user.email ?? null,
        image: membership.user.image ?? null,
      });
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }),
  members: protectedProcedure
    .input(z.object({ taskId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);
      await assertTaskMember({ userId, taskId: input.taskId });
      return db.taskMember.findMany({
        where: { taskId: input.taskId },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { role: 'asc' },
      });
    }),
  inviteMember: protectedProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        email: z.string().email(),
        role: z.nativeEnum(MemberRole).default(MemberRole.EDITOR),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);
      await assertTaskOwner({ userId, taskId: input.taskId });
      const target = await db.user.findUnique({
        where: { email: input.email.toLowerCase() },
      });
      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }
      if (target.id === userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You are already the owner of this task.',
        });
      }
      await db.taskMember.upsert({
        where: { taskId_userId: { taskId: input.taskId, userId: target.id } },
        create: {
          taskId: input.taskId,
          userId: target.id,
          role: input.role,
        },
        update: { role: input.role },
      });
      await invalidateTaskListCache(userId);
      await invalidateTaskListCache(target.id);
      return db.taskMember.findFirst({
        where: { taskId: input.taskId, userId: target.id },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      });
    }),
  updateMemberRole: protectedProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        userId: z.string().min(1),
        role: z.nativeEnum(MemberRole),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);
      await assertTaskOwner({ userId, taskId: input.taskId });
      if (input.userId === userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Update another collaborator to change roles.',
        });
      }
      return db.taskMember.update({
        where: { taskId_userId: { taskId: input.taskId, userId: input.userId } },
        data: { role: input.role },
      });
    }),
  removeMember: protectedProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);
      await assertTaskOwner({ userId, taskId: input.taskId });
      if (input.userId === userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Transfer ownership before removing yourself.',
        });
      }
      await db.taskMember.delete({
        where: { taskId_userId: { taskId: input.taskId, userId: input.userId } },
      });
      await invalidateTaskListCache(input.userId);
      return { success: true };
    }),
});
