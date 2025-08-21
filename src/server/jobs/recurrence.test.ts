import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecurrenceType, TaskPriority } from '@prisma/client';
import { generateRecurringTasks } from './recurrence';

const hoisted = vi.hoisted(() => {
  return {
    findMany: vi.fn(),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    count: vi.fn(),
  };
});

vi.mock('@/server/db', () => ({
  db: {
    task: {
      findMany: hoisted.findMany,
      findFirst: hoisted.findFirst,
      create: hoisted.create,
      count: hoisted.count,
    },
  },
}));

describe('generateRecurringTasks', () => {
  beforeEach(() => {
    hoisted.findMany.mockReset();
    hoisted.findFirst.mockReset();
    hoisted.create.mockReset();
    hoisted.count.mockReset();
  });

  it('does not create tasks past recurrenceCount', async () => {
    hoisted.findMany.mockResolvedValue([
      {
        id: '1',
        title: 'T',
        dueAt: new Date('2024-01-01'),
        recurrenceType: RecurrenceType.DAILY,
        recurrenceInterval: 1,
        recurrenceCount: 2,
        recurrenceUntil: null,
        subject: null,
        notes: null,
        priority: TaskPriority.MEDIUM,
        userId: 'u1',
        projectId: null,
        courseId: null,
      },
    ]);
    hoisted.count.mockResolvedValue(2);
    await generateRecurringTasks(new Date('2024-01-02'));
    expect(hoisted.create).not.toHaveBeenCalled();
  });

  it('does not create tasks past recurrenceUntil date', async () => {
    hoisted.findMany.mockResolvedValue([
      {
        id: '1',
        title: 'T',
        dueAt: new Date('2024-01-01'),
        recurrenceType: RecurrenceType.DAILY,
        recurrenceInterval: 1,
        recurrenceCount: null,
        recurrenceUntil: new Date('2024-01-02'),
        subject: null,
        notes: null,
        priority: TaskPriority.MEDIUM,
        userId: 'u1',
        projectId: null,
        courseId: null,
      },
    ]);
    hoisted.count.mockResolvedValue(1);
    await generateRecurringTasks(new Date('2024-01-03'));
    expect(hoisted.create).not.toHaveBeenCalled();
  });
});
