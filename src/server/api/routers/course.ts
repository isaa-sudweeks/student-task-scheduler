import { z } from 'zod';
import { TaskStatus, Weekday } from '@prisma/client';
import { protectedProcedure, router } from '../trpc';
import { db } from '@/server/db';
import { TRPCError } from '@trpc/server';

const timeString = z
  .string()
  .regex(/^\d{2}:\d{2}$/)
  .refine((value) => {
    const [h, m] = value.split(':').map(Number);
    return Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h < 24 && m >= 0 && m < 60;
  }, 'Invalid time format');

const meetingInputSchema = z.object({
  dayOfWeek: z.nativeEnum(Weekday),
  startTime: timeString,
  endTime: timeString,
  location: z.string().max(200).optional(),
});

const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const transformMeetings = (meetings: z.infer<typeof meetingInputSchema>[]) => {
  return meetings.map((meeting, index) => {
    const startMinutes = toMinutes(meeting.startTime);
    const endMinutes = toMinutes(meeting.endTime);
    if (endMinutes <= startMinutes) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Meeting ${index + 1} end time must be after start time`,
      });
    }
    return {
      dayOfWeek: meeting.dayOfWeek,
      startMinutes,
      endMinutes,
      location: meeting.location ?? null,
    };
  });
};

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
            select: { dueAt: true },
            where: {
              status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
              dueAt: { not: null },
            },
            orderBy: { dueAt: 'asc' },
            take: 1,
          },
          meetings: true,
        },
      });
      return courses.map(({ tasks, meetings, ...c }) => ({
        ...c,
        meetings,
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
        instructorName: z.string().min(1).max(200).optional(),
        instructorEmail: z.string().email().optional(),
        officeHours: z.array(z.string().min(1).max(200)).optional(),
        meetings: z.array(meetingInputSchema).optional(),
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
        instructorName: input.instructorName ?? null,
        instructorEmail: input.instructorEmail ?? null,
        officeHours: input.officeHours ?? [],
      };
      if (typeof input.syllabusUrl !== 'undefined') {
        (data as any).syllabusUrl = input.syllabusUrl ?? null;
      }
      if (input.meetings?.length) {
        (data as any).meetings = {
          create: transformMeetings(input.meetings),
        };
      }
      return db.course.create({
        data: data as any,
        include: { meetings: true },
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
        instructorName: z.string().min(1).max(200).nullable().optional(),
        instructorEmail: z.string().email().nullable().optional(),
        officeHours: z.array(z.string().min(1).max(200)).optional(),
        meetings: z.array(meetingInputSchema).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const { id, ...rest } = input;
      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (typeof value === 'undefined') continue;
        if (key === 'meetings') continue;
        if (key === 'officeHours') {
          data.officeHours = value;
          continue;
        }
        data[key] = value;
      }
      if (typeof rest.meetings !== 'undefined') {
        const meetings = transformMeetings(rest.meetings);
        (data as any).meetings = {
          deleteMany: {},
          create: meetings,
        };
      }
      if (Object.keys(data).length === 0) {
        return db.course.findUniqueOrThrow({ where: { id, userId }, include: { meetings: true } });
      }
      return db.course.update({ where: { id, userId }, data, include: { meetings: true } });
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
