import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LlmProvider, TaskPriority, TaskStatus } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { taskScheduleRouter } from './taskSchedule';

const mocks = vi.hoisted(() => ({
  generateScheduleSuggestions: vi.fn(),
  userFindUnique: vi.fn(),
  taskFindMany: vi.fn(),
  eventFindMany: vi.fn(),
}));

vi.mock('@/server/ai/scheduler', () => ({
  generateScheduleSuggestions: (...args: unknown[]) => mocks.generateScheduleSuggestions(...args),
}));

vi.mock('@/server/db', () => ({
  db: {
    user: { findUnique: mocks.userFindUnique },
    task: { findMany: mocks.taskFindMany },
    event: { findMany: mocks.eventFindMany },
  },
}));

describe('taskScheduleRouter.scheduleSuggestions', () => {
  const ctx = { session: { user: { id: 'user1' } } } as any;
  const generateScheduleSuggestions = mocks.generateScheduleSuggestions;
  const userFindUnique = mocks.userFindUnique;
  const taskFindMany = mocks.taskFindMany;
  const eventFindMany = mocks.eventFindMany;

  beforeEach(() => {
    userFindUnique.mockReset();
    taskFindMany.mockReset();
    eventFindMany.mockReset();
    generateScheduleSuggestions.mockReset();
  });

  it('requires authentication', async () => {
    await expect(
      taskScheduleRouter.createCaller({ session: { user: null } } as any).scheduleSuggestions({}),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it('returns empty suggestions when there are no tasks', async () => {
    userFindUnique.mockResolvedValue({
      id: 'user1',
      timezone: 'UTC',
      dayWindowStartHour: 8,
      dayWindowEndHour: 18,
      defaultDurationMinutes: 30,
      llmProvider: LlmProvider.NONE,
      openaiApiKey: null,
      lmStudioUrl: 'http://localhost:1234',
    });
    taskFindMany.mockResolvedValue([]);

    const result = await taskScheduleRouter.createCaller(ctx).scheduleSuggestions({});
    expect(result).toEqual({ suggestions: [] });
    expect(eventFindMany).not.toHaveBeenCalled();
  });

  it('fetches tasks and delegates to scheduler', async () => {
    const task = {
      id: 'task1',
      title: 'Task 1',
      dueAt: new Date('2024-01-05T10:00:00Z'),
      effortMinutes: 45,
      priority: TaskPriority.HIGH,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      notes: 'Study',
    };
    userFindUnique.mockResolvedValue({
      id: 'user1',
      timezone: 'UTC',
      dayWindowStartHour: 8,
      dayWindowEndHour: 18,
      defaultDurationMinutes: 30,
      llmProvider: LlmProvider.NONE,
      openaiApiKey: null,
      lmStudioUrl: 'http://localhost:1234',
    });
    taskFindMany.mockResolvedValue([task]);
    eventFindMany.mockResolvedValue([]);
    generateScheduleSuggestions.mockImplementation(async (args: any) => {
      expect(args.tasks[0].effortMinutes).toBe(45);
      return [
        {
          taskId: 'task1',
          startAt: new Date('2024-01-04T10:00:00Z'),
          endAt: new Date('2024-01-04T10:45:00Z'),
          origin: 'fallback',
        },
      ];
    });

    const result = await taskScheduleRouter.createCaller(ctx).scheduleSuggestions({});

    expect(taskFindMany).toHaveBeenCalledWith({
      where: {
        userId: 'user1',
        status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
        events: { none: {} },
      },
      select: {
        id: true,
        title: true,
        dueAt: true,
        effortMinutes: true,
        priority: true,
        createdAt: true,
        notes: true,
      },
      orderBy: [
        { dueAt: { sort: 'asc', nulls: 'last' } },
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });
    expect(eventFindMany).toHaveBeenCalledWith({
      where: { task: { userId: 'user1' } },
      select: { startAt: true, endAt: true },
    });
    expect(generateScheduleSuggestions).toHaveBeenCalled();
    expect(result.suggestions).toHaveLength(1);
  });
});
