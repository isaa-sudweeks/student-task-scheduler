import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import { GoalType } from '@prisma/client';
import { userRouter } from '@/server/api/routers/user';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  findFirstCourse: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  db: {
    user: { update: vi.fn() },
    studyGoal: {
      findMany: mocks.findMany,
      upsert: mocks.upsert,
      deleteMany: mocks.deleteMany,
    },
    course: {
      findFirst: mocks.findFirstCourse,
    },
  },
}));

describe('user goals router', () => {
  const ctx = { session: { user: { id: 'user-1', timezone: 'UTC' } } } as const;

  beforeEach(() => {
    mocks.findMany.mockReset();
    mocks.upsert.mockReset();
    mocks.deleteMany.mockReset();
    mocks.findFirstCourse.mockReset();
  });

  it('lists goals with derived labels', async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: 'g1',
        userId: 'user-1',
        type: GoalType.SUBJECT,
        subject: 'Math',
        courseId: null,
        targetMinutes: 180,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z'),
        course: null,
      },
      {
        id: 'g2',
        userId: 'user-1',
        type: GoalType.COURSE,
        subject: null,
        courseId: 'course-1',
        targetMinutes: 200,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z'),
        course: { id: 'course-1', title: 'Physics 101' },
      },
    ]);

    const caller = userRouter.createCaller(ctx);
    const goals = await caller.listGoals();

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      include: { course: { select: { id: true, title: true } } },
      orderBy: [{ type: 'asc' }, { subject: 'asc' }, { courseId: 'asc' }],
    });
    expect(goals).toEqual([
      expect.objectContaining({ id: 'g1', label: 'Math', targetMinutes: 180 }),
      expect.objectContaining({ id: 'g2', label: 'Physics 101', targetMinutes: 200 }),
    ]);
  });

  it('upserts a subject goal', async () => {
    mocks.findFirstCourse.mockResolvedValue(null);
    mocks.upsert.mockResolvedValue({
      id: 'g1',
      userId: 'user-1',
      type: GoalType.SUBJECT,
      subject: 'Science',
      courseId: null,
      targetMinutes: 150,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      course: null,
    });

    const caller = userRouter.createCaller(ctx);
    const result = await caller.upsertGoal({
      type: GoalType.SUBJECT,
      subject: 'Science',
      targetMinutes: 150,
    });

    expect(mocks.upsert).toHaveBeenCalledWith({
      where: {
        userId_type_subject: {
          userId: 'user-1',
          type: GoalType.SUBJECT,
          subject: 'Science',
        },
      },
      update: { targetMinutes: 150, subject: 'Science', courseId: null },
      create: {
        userId: 'user-1',
        type: GoalType.SUBJECT,
        subject: 'Science',
        courseId: null,
        targetMinutes: 150,
      },
      include: { course: { select: { id: true, title: true } } },
    });
    expect(result).toMatchObject({ id: 'g1', label: 'Science', targetMinutes: 150 });
  });

  it('requires a course owned by the user when creating a course goal', async () => {
    mocks.findFirstCourse.mockResolvedValue(null);

    const caller = userRouter.createCaller(ctx);
    await expect(
      caller.upsertGoal({
        type: GoalType.COURSE,
        courseId: 'course-1',
        targetMinutes: 90,
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it('deletes a goal scoped to the user', async () => {
    mocks.deleteMany.mockResolvedValue({ count: 1 });
    const caller = userRouter.createCaller(ctx);
    await expect(caller.deleteGoal({ id: 'goal-1' })).resolves.toEqual({ success: true });
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: 'goal-1', userId: 'user-1' } });
  });
});
