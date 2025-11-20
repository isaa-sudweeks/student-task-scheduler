import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { TaskStatus, TaskPriority, Prisma, RecurrenceType } from '@prisma/client';
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

export const taskCrudRouter = router({
  subjectOptions: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx);
    const cacheKey = buildSubjectOptionsCacheKey(userId);
    const cached = await cache.get<string[]>(cacheKey);
    if (cached) return cached;

    const subjects = await db.task.findMany({
      where: { userId, subject: { not: null } },
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

      // Show only DONE in archive; otherwise include all by default
      const baseWhere: Prisma.TaskWhereInput =
        filter === 'archive' ? { status: TaskStatus.DONE, userId } : { userId };

      let where: Prisma.TaskWhereInput =
        filter === 'overdue'
          ? { ...baseWhere, dueAt: { lt: nowUtc } }
          : filter === 'today'
          ? { ...baseWhere, dueAt: { gte: startUtc, lte: endUtc } }
          : baseWhere;

      if (subject) {
        where = { ...where, subject };
      }
      if (status) {
        where = { ...where, status };
      }
      if (priority) {
        where = { ...where, priority };
      }
      if (courseId) {
        where = { ...where, courseId };
      }
      if (projectId) {
        where = { ...where, projectId };
      }
      if (parentId !== undefined) {
        where = { ...where, parentId };
      }

      const start = input?.start;
      const end = input?.end;
      if (start || end) {
        where = {
          ...where,
          createdAt: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lte: end } : {}),
          },
        };
      }

      const limit = input?.limit;
      const cursor = input?.cursor;
      const dueAtOrder: Prisma.TaskOrderByWithRelationInput = {
        dueAt: { sort: 'asc', nulls: 'last' },
      };

      type TaskWithCourse = Prisma.TaskGetPayload<{ include: { course: true } }>;
      const cacheKey = buildListCacheKey(input, ctx.session?.user?.id ?? null);
      const cached = await cache.get<TaskWithCourse[]>(cacheKey);
      if (cached) return cached;

      const tasks = await db.task.findMany({
        where,
        include: { course: true },
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
      const existing = await db.task.findFirst({ where: { id, userId } });
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
      const existing = await db.task.findFirst({ where: { id: input.id, userId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      const updated = await db.task.update({ where: { id: input.id }, data: { dueAt: input.dueAt ?? null } });
      await invalidateTaskListCache(userId);
      return updated;
    }),
  updateTitle: protectedProcedure
    .input(z.object({ id: z.string().min(1), title: z.string().min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      const existing = await db.task.findFirst({ where: { id: input.id, userId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
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
      const existing = await db.task.findFirst({ where: { id: input.id, userId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      const updated = await db.task.update({ where: { id: input.id }, data: { status: input.status } });
      await invalidateTaskListCache(userId);
      return updated;
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      const existing = await db.task.findFirst({ where: { id: input.id, userId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
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
          where: { taskId: input.id, task: { userId } },
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
        db.reminder.deleteMany({ where: { taskId: input.id, task: { userId } } }),
        db.event.deleteMany({ where: { taskId: input.id, task: { userId } } }),
        db.task.delete({ where: { id: input.id } }),
      ]);
      await invalidateTaskListCache(userId);
      return deleted;
    }),
});
