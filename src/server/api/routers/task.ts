import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { TaskStatus, TaskPriority, Prisma, RecurrenceType } from '@prisma/client';
import { publicProcedure, router } from '../trpc';
import { db } from '@/server/db';
import { cache } from '@/server/cache';
import type { Task } from '@prisma/client';

const TASK_LIST_CACHE_PREFIX = 'task:list:';

const buildListCacheKey = (input: unknown, userId: string | null) =>
  `${TASK_LIST_CACHE_PREFIX}${userId ?? 'null'}:${JSON.stringify(input ?? {})}`;

const invalidateTaskListCache = () => cache.clear();
export const taskRouter = router({
  // No authentication: list all tasks
  list: publicProcedure
    .input(
      z
        .object({
          filter: z.enum(['all', 'overdue', 'today', 'archive']).optional(),
          subject: z.string().optional(),
          priority: z.nativeEnum(TaskPriority).optional(),
          courseId: z.string().optional(),
          projectId: z.string().optional(),
          // Minutes to add to UTC to get client local time offset (Date.getTimezoneOffset style)
          tzOffsetMinutes: z.number().int().optional(),
          // Optional explicit client-local day bounds as absolute instants
          todayStart: z.date().optional(),
          todayEnd: z.date().optional(),
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const filter = input?.filter ?? 'all';
      const subject = input?.subject;
      const priority = input?.priority;
      const courseId = input?.courseId;
      const projectId = input?.projectId;
      const tzOffsetMinutes = input?.tzOffsetMinutes ?? null;
      const nowUtc = new Date();

      // Prefer explicit bounds from client when provided; otherwise compute from user tz or offset
      let startUtc: Date;
      let endUtc: Date;
      if (input?.todayStart && input?.todayEnd) {
        startUtc = input.todayStart;
        endUtc = input.todayEnd;
      } else if (ctx.session?.user?.timezone) {
        const tz = ctx.session.user.timezone;
        const nowTz = new Date(nowUtc.toLocaleString('en-US', { timeZone: tz }));
        const startTz = new Date(nowTz);
        startTz.setHours(0, 0, 0, 0);
        const endTz = new Date(nowTz);
        endTz.setHours(23, 59, 59, 999);
        startUtc = new Date(startTz.toLocaleString('en-US', { timeZone: 'UTC' }));
        endUtc = new Date(endTz.toLocaleString('en-US', { timeZone: 'UTC' }));
      } else {
        const nowClient = tzOffsetMinutes != null
          ? new Date(nowUtc.getTime() - tzOffsetMinutes * 60 * 1000)
          : nowUtc;
        const startClient = new Date(nowClient);
        startClient.setHours(0, 0, 0, 0);
        const endClient = new Date(nowClient);
        endClient.setHours(23, 59, 59, 999);
        startUtc = tzOffsetMinutes != null
          ? new Date(startClient.getTime() + tzOffsetMinutes * 60 * 1000)
          : startClient;
        endUtc = tzOffsetMinutes != null
          ? new Date(endClient.getTime() + tzOffsetMinutes * 60 * 1000)
          : endClient;
      }

      // Show only DONE in archive; otherwise include all by default
      const baseWhere: Prisma.TaskWhereInput =
        filter === 'archive'
          ? { status: TaskStatus.DONE }
          : {};

      let where: Prisma.TaskWhereInput =
        filter === 'overdue'
          ? { ...baseWhere, dueAt: { lt: nowUtc } }
          : filter === 'today'
          ? { ...baseWhere, dueAt: { gte: startUtc, lte: endUtc } }
          : baseWhere;

      if (subject) {
        where = { ...where, subject };
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
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        dueAt: z.date().nullable().optional(),
        subject: z.string().max(100).optional(),
        notes: z.string().max(2000).optional(),
        priority: z.nativeEnum(TaskPriority).optional(),
        recurrenceType: z.nativeEnum(RecurrenceType).optional(),
        recurrenceInterval: z.number().int().min(1).optional(),
        recurrenceCount: z.number().int().min(1).optional(),
        recurrenceUntil: z.date().optional(),
        projectId: z.string().min(1).optional(),
        courseId: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.dueAt && input.dueAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Due date cannot be in the past' });
      }
      const created = await db.task.create({
        data: {
          title: input.title,
          dueAt: input.dueAt ?? null,
          subject: input.subject ?? null,
          notes: input.notes ?? null,
          priority: input.priority ?? undefined,
          recurrenceType: input.recurrenceType ?? undefined,
          recurrenceInterval: input.recurrenceInterval ?? undefined,
          recurrenceCount: input.recurrenceCount ?? undefined,
          recurrenceUntil: input.recurrenceUntil ?? undefined,
          projectId: input.projectId ?? undefined,
          courseId: input.courseId ?? undefined,
        },
      });
      await invalidateTaskListCache();
      return created;
    }),
  update: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(200).optional(),
        subject: z.string().max(100).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
        dueAt: z.date().nullable().optional(),
        priority: z.nativeEnum(TaskPriority).optional(),
        recurrenceType: z.nativeEnum(RecurrenceType).optional(),
        recurrenceInterval: z.number().int().min(1).optional(),
        recurrenceCount: z.number().int().min(1).nullable().optional(),
        recurrenceUntil: z.date().nullable().optional(),
        projectId: z.string().nullable().optional(),
        courseId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.dueAt && input.dueAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Due date cannot be in the past' });
      }
      const { id, ...rest } = input;
      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (typeof value !== 'undefined') data[key] = value;
      }
      let result: Task;
      if (Object.keys(data).length === 0) {
        result = await db.task.findUniqueOrThrow({ where: { id } });
      } else {
        result = await db.task.update({ where: { id }, data: data as Prisma.TaskUpdateInput });
      }
      await invalidateTaskListCache();
      return result;
    }),
  setDueDate: publicProcedure
    .input(
      z.object({ id: z.string().min(1), dueAt: z.date().nullable() })
    )
    .mutation(async ({ input }) => {
      if (input.dueAt && input.dueAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Due date cannot be in the past' });
      }
      const updated = await db.task.update({ where: { id: input.id }, data: { dueAt: input.dueAt ?? null } });
      await invalidateTaskListCache();
      return updated;
    }),
  updateTitle: publicProcedure
    .input(
      z.object({ id: z.string().min(1), title: z.string().min(1).max(200) })
    )
    .mutation(async ({ input }) => {
      const updated = await db.task.update({ where: { id: input.id }, data: { title: input.title } });
      await invalidateTaskListCache();
      return updated;
    }),
  setStatus: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]),
      })
    )
    .mutation(async ({ input }) => {
      const updated = await db.task.update({ where: { id: input.id }, data: { status: input.status } });
      await invalidateTaskListCache();
      return updated;
    }),
  bulkUpdate: publicProcedure
    .input(
      z.object({
        ids: z.array(z.string().min(1)),
        status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]),
      })
    )
    .mutation(async ({ input }) => {
      await db.task.updateMany({
        where: { id: { in: input.ids } },
        data: { status: input.status },
      });
      await invalidateTaskListCache();
      return { success: true };
    }),
  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      // Be resilient even if DB referential actions aren't cascaded yet
      const [, , deleted] = await db.$transaction([
        db.reminder.deleteMany({ where: { taskId: input.id } }),
        db.event.deleteMany({ where: { taskId: input.id } }),
        db.task.delete({ where: { id: input.id } }),
      ]);
      await invalidateTaskListCache();
      return deleted;
    }),
  bulkDelete: publicProcedure
    .input(z.object({ ids: z.array(z.string().min(1)) }))
    .mutation(async ({ input }) => {
      await db.$transaction([
        db.reminder.deleteMany({ where: { taskId: { in: input.ids } } }),
        db.event.deleteMany({ where: { taskId: { in: input.ids } } }),
        db.task.deleteMany({ where: { id: { in: input.ids } } }),
      ]);
      await invalidateTaskListCache();
      return { success: true };
    }),
  reorder: publicProcedure
    .input(z.object({ ids: z.array(z.string().min(1)) }))
    .mutation(async ({ input }) => {
      await db.$transaction(
        input.ids.map((id, index) =>
          db.task.update({ where: { id }, data: { position: index + 1 } })
        )
      );
      await invalidateTaskListCache();
      return { success: true };
    }),
});
