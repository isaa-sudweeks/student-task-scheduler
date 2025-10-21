import { afterEach, describe, expect, it, vi } from 'vitest';
import { LlmProvider, TaskPriority } from '@prisma/client';
import {
  generateScheduleSuggestions,
  SchedulerTask,
  ScheduleSuggestion,
} from '@/server/ai/scheduler';

const baseUser = {
  id: 'user-1',
  timezone: 'UTC' as const,
  dayWindowStartHour: 8,
  dayWindowEndHour: 18,
  defaultDurationMinutes: 30,
  llmProvider: LlmProvider.NONE,
  openaiApiKey: null,
  lmStudioUrl: null,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateScheduleSuggestions', () => {
  const tasks: SchedulerTask[] = [
    {
      id: 'a',
      title: 'Essay research',
      dueAt: new Date('2024-04-02T12:00:00Z'),
      effortMinutes: 45,
      priority: TaskPriority.MEDIUM,
      createdAt: new Date('2024-03-30T09:00:00Z'),
    },
    {
      id: 'b',
      title: 'Group project',
      dueAt: new Date('2024-04-05T16:00:00Z'),
      effortMinutes: null,
      priority: TaskPriority.HIGH,
      createdAt: new Date('2024-03-29T09:00:00Z'),
    },
  ];

  it('allocates non-overlapping fallback slots when no model suggestions are available', async () => {
    const suggestions = await generateScheduleSuggestions({
      tasks,
      user: baseUser,
      existingEvents: [
        { startAt: new Date('2024-04-01T08:00:00Z'), endAt: new Date('2024-04-01T09:00:00Z') },
      ],
      now: new Date('2024-04-01T09:00:00Z'),
    });

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].taskId).toBe('a');
    expect(suggestions[0].origin).toBe('fallback');
    expect(suggestions[0].startAt.getTime()).toBeLessThan(suggestions[1].startAt.getTime());
    const overlap = overlaps(suggestions[0], suggestions[1]);
    expect(overlap).toBe(false);
  });

  it('respects model suggestions when provided by the configured provider', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                suggestions: [
                  {
                    taskId: 'b',
                    startAt: '2024-04-01T13:00:00.000Z',
                    endAt: '2024-04-01T13:45:00.000Z',
                    rationale: 'Afternoon focus window',
                    confidence: 0.9,
                  },
                ],
              }),
            },
          },
        ],
      }),
    } as any);

    const suggestions = await generateScheduleSuggestions({
      tasks,
      user: { ...baseUser, llmProvider: LlmProvider.OPENAI, openaiApiKey: 'key' },
      existingEvents: [],
      now: new Date('2024-04-01T09:00:00Z'),
    });

    expect(fetchMock).toHaveBeenCalled();
    const targeted = suggestions.find((s) => s.taskId === 'b');
    expect(targeted).toMatchObject({
      origin: 'model',
      rationale: 'Afternoon focus window',
      confidence: 0.9,
    });
    expect(targeted?.startAt.toISOString()).toBe('2024-04-01T13:00:00.000Z');
  });
});

function overlaps(a: ScheduleSuggestion, b: ScheduleSuggestion) {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}
