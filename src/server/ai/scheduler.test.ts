import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LlmProvider, TaskPriority } from '@prisma/client';
import { generateScheduleSuggestions, type SchedulerTask } from './scheduler';

const baseUser = {
  id: 'user1',
  timezone: 'UTC',
  dayWindowStartHour: 8,
  dayWindowEndHour: 18,
  defaultDurationMinutes: 60,
  llmProvider: LlmProvider.NONE as const,
  openaiApiKey: null,
  lmStudioUrl: 'http://localhost:1234',
};

const makeTask = (overrides: Partial<SchedulerTask> = {}): SchedulerTask => ({
  id: overrides.id ?? `task-${Math.random().toString(36).slice(2, 7)}`,
  title: overrides.title ?? 'Task',
  dueAt: overrides.dueAt ?? null,
  effortMinutes: overrides.effortMinutes ?? null,
  priority: overrides.priority ?? TaskPriority.MEDIUM,
  createdAt: overrides.createdAt ?? new Date('2024-01-01T00:00:00Z'),
  notes: overrides.notes ?? null,
});

describe('generateScheduleSuggestions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to deterministic scheduling when no provider configured', async () => {
    const tasks = [
      makeTask({ id: 'a', dueAt: new Date('2024-01-02T16:00:00Z'), priority: TaskPriority.HIGH }),
      makeTask({ id: 'b', dueAt: new Date('2024-01-03T16:00:00Z'), priority: TaskPriority.LOW }),
    ];

    const suggestions = await generateScheduleSuggestions({
      tasks,
      user: baseUser,
      existingEvents: [
        { startAt: new Date('2024-01-02T08:00:00Z'), endAt: new Date('2024-01-02T10:00:00Z') },
      ],
      now: new Date('2024-01-01T12:00:00Z'),
    });

    expect(suggestions).toHaveLength(2);
    const taskIds = suggestions.map((s) => s.taskId);
    expect(taskIds.sort()).toEqual(['a', 'b']);
    expect(suggestions.every((s) => s.origin === 'fallback')).toBe(true);
    expect(suggestions[0].startAt.getTime()).toBeLessThan(suggestions[1].startAt.getTime());
  });

  it('respects task-specific effort durations when scheduling', async () => {
    const tasks = [
      makeTask({
        id: 'focus-task',
        dueAt: new Date('2024-01-02T14:00:00Z'),
        effortMinutes: 30,
      }),
    ];

    const suggestions = await generateScheduleSuggestions({
      tasks,
      user: baseUser,
      existingEvents: [],
      now: new Date('2024-01-01T08:00:00Z'),
    });

    expect(suggestions).toHaveLength(1);
    const durationMinutes =
      (suggestions[0].endAt.getTime() - suggestions[0].startAt.getTime()) / 60_000;
    expect(durationMinutes).toBe(30);
  });

  it('uses model suggestions when provider returns valid data', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                suggestions: [
                  {
                    taskId: 'a',
                    startAt: '2024-01-02T12:00:00.000Z',
                    endAt: '2024-01-02T13:00:00.000Z',
                    rationale: 'LLM suggestion',
                  },
                ],
              }),
            },
          },
        ],
      }),
    } as any);

    const tasks = [makeTask({ id: 'a' })];

    const suggestions = await generateScheduleSuggestions({
      tasks,
      user: { ...baseUser, llmProvider: LlmProvider.OPENAI, openaiApiKey: 'test-key' },
      existingEvents: [],
      now: new Date('2024-01-01T08:00:00Z'),
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].origin).toBe('model');
    expect(suggestions[0].rationale).toBe('LLM suggestion');
  });

  it('falls back when model response is invalid', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not json' } }] }),
    } as any);

    const tasks = [makeTask({ id: 'a' })];

    const suggestions = await generateScheduleSuggestions({
      tasks,
      user: { ...baseUser, llmProvider: LlmProvider.OPENAI, openaiApiKey: 'test-key' },
      existingEvents: [],
      now: new Date('2024-01-01T08:00:00Z'),
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].origin).toBe('fallback');
  });
});

