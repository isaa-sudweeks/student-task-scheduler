import { LlmProvider, TaskPriority } from '@prisma/client';
import { z } from 'zod';
import { findNonOverlappingSlot, Interval } from '@/lib/scheduling';
import { createTimezoneConverter } from './timezone';

const isoString = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Invalid ISO string' });

const suggestionSchema = z.object({
  taskId: z.string().min(1),
  startAt: isoString,
  endAt: isoString,
  rationale: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const responseSchema = z.object({ suggestions: z.array(suggestionSchema) });

export type SchedulerTask = {
  id: string;
  title: string;
  dueAt: Date | null;
  effortMinutes: number | null;
  priority: TaskPriority;
  createdAt: Date;
  notes?: string | null;
};

export type ScheduleSuggestion = {
  taskId: string;
  startAt: Date;
  endAt: Date;
  origin: 'model' | 'fallback';
  rationale?: string;
  confidence?: number;
};

export type SchedulerContext = {
  user: {
    id: string;
    timezone: string | null;
    dayWindowStartHour: number;
    dayWindowEndHour: number;
    defaultDurationMinutes: number;
    llmProvider: LlmProvider;
    openaiApiKey?: string | null;
    lmStudioUrl?: string | null;
  };
  existingEvents: Interval[];
  now?: Date;
};

type ModelSuggestion = z.infer<typeof suggestionSchema>;

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  [TaskPriority.HIGH]: 3,
  [TaskPriority.MEDIUM]: 2,
  [TaskPriority.LOW]: 1,
};

export async function generateScheduleSuggestions({
  tasks,
  user,
  existingEvents,
  now = new Date(),
}: SchedulerContext & { tasks: SchedulerTask[] }): Promise<ScheduleSuggestion[]> {
  if (tasks.length === 0) return [];

  const timezoneConverter = createTimezoneConverter(user.timezone);
  const nowLocal = timezoneConverter.toZoned(now);

  const baseIntervals = existingEvents.map((interval) =>
    timezoneConverter.intervalToZoned({
      startAt: new Date(interval.startAt),
      endAt: new Date(interval.endAt),
    }),
  );

  const modelSuggestions = await loadModelSuggestions(tasks, user, now).catch(() => []);
  const preferredStartByTask = new Map<string, { startAt: Date; endAt: Date; rationale?: string; confidence?: number }>();
  for (const suggestion of modelSuggestions) {
    const start = new Date(suggestion.startAt);
    const end = new Date(suggestion.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) continue;
    preferredStartByTask.set(suggestion.taskId, {
      startAt: start,
      endAt: end,
      rationale: suggestion.rationale,
      confidence: suggestion.confidence,
    });
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.dueAt && b.dueAt) {
      const diff = a.dueAt.getTime() - b.dueAt.getTime();
      if (diff !== 0) return diff;
    } else if (a.dueAt && !b.dueAt) {
      return -1;
    } else if (!a.dueAt && b.dueAt) {
      return 1;
    }
    const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const results: ScheduleSuggestion[] = [];
  const intervals = [...baseIntervals];

  for (const task of sortedTasks) {
    const durationMinutes = Math.max(task.effortMinutes ?? user.defaultDurationMinutes, 15);
    const preferred = preferredStartByTask.get(task.id);
    const desiredStartUtc = preferred?.startAt
      ? new Date(preferred.startAt)
      : computeBaselineStart(task, now, durationMinutes);
    const desiredStartLocal = timezoneConverter.toZoned(desiredStartUtc);
    const slotLocal = allocateSlot({
      desiredStart: desiredStartLocal,
      durationMinutes,
      intervals,
      dayWindowStartHour: user.dayWindowStartHour,
      dayWindowEndHour: user.dayWindowEndHour,
      currentTime: nowLocal,
    });
    intervals.push(slotLocal);
    const slotUtc = timezoneConverter.intervalToUtc(slotLocal);
    results.push({
      taskId: task.id,
      startAt: slotUtc.startAt,
      endAt: slotUtc.endAt,
      origin: preferred ? 'model' : 'fallback',
      rationale: preferred?.rationale,
      confidence: preferred?.confidence,
    });
  }

  return results.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

function computeBaselineStart(task: SchedulerTask, now: Date, durationMinutes: number): Date {
  if (task.dueAt) {
    const candidate = new Date(task.dueAt.getTime() - durationMinutes * 60_000);
    if (candidate > now) return candidate;
  }
  return new Date(now);
}

function allocateSlot({
  desiredStart,
  durationMinutes,
  intervals,
  dayWindowStartHour,
  dayWindowEndHour,
  currentTime,
}: {
  desiredStart: Date;
  durationMinutes: number;
  intervals: Interval[];
  dayWindowStartHour: number;
  dayWindowEndHour: number;
  currentTime: Date;
}): Interval {
  const now = new Date(currentTime);
  const start = new Date(desiredStart < now ? now : desiredStart);
  start.setSeconds(0, 0);

  let cursor = new Date(start);
  const searchDays = 30;
  for (let dayOffset = 0; dayOffset < searchDays; dayOffset++) {
    const slot = findNonOverlappingSlot({
      desiredStart: cursor,
      durationMinutes,
      dayWindowStartHour,
      dayWindowEndHour,
      existing: intervals,
      stepMinutes: 15,
    });
    if (slot) return slot;
    cursor = nextDayStart(cursor, dayWindowStartHour);
  }

  const fallbackStart = computeFallbackStart({ intervals, start, dayWindowStartHour, dayWindowEndHour });
  return {
    startAt: fallbackStart,
    endAt: new Date(fallbackStart.getTime() + durationMinutes * 60_000),
  };
}

function computeFallbackStart({
  intervals,
  start,
  dayWindowStartHour,
  dayWindowEndHour,
}: {
  intervals: Interval[];
  start: Date;
  dayWindowStartHour: number;
  dayWindowEndHour: number;
}): Date {
  const latest = intervals.reduce((acc, interval) => Math.max(acc, interval.endAt.getTime()), 0);
  let candidate = new Date(Math.max(start.getTime(), latest));
  if (candidate.getHours() < dayWindowStartHour) {
    candidate.setHours(dayWindowStartHour, 0, 0, 0);
  }
  if (candidate.getHours() > dayWindowEndHour || (candidate.getHours() === dayWindowEndHour && candidate.getMinutes() > 0)) {
    candidate = nextDayStart(candidate, dayWindowStartHour);
  }
  return candidate;
}

function nextDayStart(from: Date, dayWindowStartHour: number) {
  const next = new Date(from);
  next.setDate(next.getDate() + 1);
  next.setHours(dayWindowStartHour, 0, 0, 0);
  return next;
}

async function loadModelSuggestions(tasks: SchedulerTask[], user: SchedulerContext['user'], now: Date) {
  if (user.llmProvider === LlmProvider.OPENAI) {
    if (!user.openaiApiKey) return [];
    const content = await callChatCompletion({
      url: 'https://api.openai.com/v1/chat/completions',
      apiKey: user.openaiApiKey,
      model: 'gpt-4o-mini',
      prompt: buildPrompt(tasks, user, now),
    });
    return parseModelResponse(content);
  }
  if (user.llmProvider === LlmProvider.LM_STUDIO) {
    const base = (user.lmStudioUrl ?? '').replace(/\/$/, '') || 'http://localhost:1234';
    const content = await callChatCompletion({
      url: `${base}/v1/chat/completions`,
      model: 'lmstudio-community/Meta-Llama-3-8B-Instruct',
      prompt: buildPrompt(tasks, user, now),
    });
    return parseModelResponse(content);
  }
  return [];
}

function buildPrompt(tasks: SchedulerTask[], user: SchedulerContext['user'], now: Date) {
  const taskContext = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    dueAt: task.dueAt?.toISOString() ?? null,
    effortMinutes: task.effortMinutes ?? user.defaultDurationMinutes,
    priority: task.priority,
    notes: task.notes ?? null,
  }));
  return [
    'You are an assistant that schedules student tasks.',
    `Current time: ${now.toISOString()}.`,
    `The user works between local hours ${user.dayWindowStartHour}:00 and ${user.dayWindowEndHour}:00.`,
    `Suggest start and end times for each task using ISO 8601 timestamps. Times should fall within the preferred hours.`,
    `Return JSON only in the shape {"suggestions":[{"taskId","startAt","endAt","rationale?","confidence?"}]}.`,
    'taskId must match the provided id exactly. Include every task exactly once.',
    `Tasks: ${JSON.stringify(taskContext, null, 2)}`,
  ].join('\n');
}

async function callChatCompletion({
  url,
  model,
  prompt,
  apiKey,
}: {
  url: string;
  model: string;
  prompt: string;
  apiKey?: string;
}): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You output strict JSON with ISO 8601 timestamps.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    }),
  });
  if (!response.ok) {
    throw new Error(`Model request failed with status ${response.status}`);
  }
  const data = (await response.json()) as any;
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('Model returned no content');
  }
  return content;
}

function parseModelResponse(content: string): ModelSuggestion[] {
  const trimmed = content.trim();
  const parsed = responseSchema.safeParse(JSON.parse(trimmed));
  if (!parsed.success) {
    throw new Error('Invalid model response');
  }
  return parsed.data.suggestions;
}

