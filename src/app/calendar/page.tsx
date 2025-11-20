"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, type DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { api } from '@/server/api/react';
import type { RouterOutputs } from '@/server/api/root';
import { calculateDurationMinutes } from '@/lib/datetime';
import { CalendarGrid, DraggableTask } from '@/components/calendar/CalendarGrid';
import { CalendarHeader } from '@/components/calendar/CalendarHeader';
import { ErrorBoundary } from '@/components/error-boundary';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';

type ViewMode = 'day' | 'week' | 'month';
type Task = RouterOutputs['task']['list'][number];
type Event = RouterOutputs['event']['listRange'][number];
type ScheduleSuggestion = RouterOutputs['task']['scheduleSuggestions']['suggestions'][number];

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>('week');
  const [baseDate, setBaseDate] = useState<Date>(new Date());
  const utils = api.useUtils();
  const { data: session } = useSession();
  const isAuthenticated = !!session;

  const [dayStart, setDayStart] = useState(8);
  const [dayEnd, setDayEnd] = useState(18);
  const [defaultDuration, setDefaultDuration] = useState(30);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskStart, setNewTaskStart] = useState<Date | null>(null);
  const parseStoredNumber = React.useCallback((value: string | null) => {
    if (value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }, []);
  const userSettingsQuery = api.user.getSettings.useQuery(undefined, { enabled: isAuthenticated });
  const userSettings = userSettingsQuery.data;
  const { mutate: setSettingsMutate } = api.user.setSettings.useMutation({
    onSuccess: async () => {
      try {
        await utils.user.getSettings.invalidate();
      } catch {}
    },
  });
  const lastSyncedRef = useRef<{
    dayWindowStartHour: number;
    dayWindowEndHour: number;
    defaultDurationMinutes: number;
  } | null>(null);
  const hasLoadedServerSettingsRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const s = parseStoredNumber(window.localStorage.getItem('dayWindowStartHour'));
    const e = parseStoredNumber(window.localStorage.getItem('dayWindowEndHour'));
    const d = parseStoredNumber(window.localStorage.getItem('defaultDurationMinutes'));
    if (s != null) setDayStart(s);
    if (e != null) setDayEnd(e);
    if (d != null) setDefaultDuration(d);
  }, [parseStoredNumber]);
  useEffect(() => {
    if (!userSettings) return;
    hasLoadedServerSettingsRef.current = false;
    setDayStart(userSettings.dayWindowStartHour);
    setDayEnd(userSettings.dayWindowEndHour);
    setDefaultDuration(userSettings.defaultDurationMinutes);
  }, [userSettings]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('dayWindowStartHour', String(dayStart));
    window.localStorage.setItem('dayWindowEndHour', String(dayEnd));
    window.localStorage.setItem('defaultDurationMinutes', String(defaultDuration));
  }, [dayStart, dayEnd, defaultDuration]);

  useEffect(() => {
    if (!isAuthenticated || !userSettings) return;

    const current = {
      dayWindowStartHour: dayStart,
      dayWindowEndHour: dayEnd,
      defaultDurationMinutes: defaultDuration,
    };

    const matchesServer =
      current.dayWindowStartHour === userSettings.dayWindowStartHour &&
      current.dayWindowEndHour === userSettings.dayWindowEndHour &&
      current.defaultDurationMinutes === userSettings.defaultDurationMinutes;

    if (!hasLoadedServerSettingsRef.current) {
      if (matchesServer) {
        hasLoadedServerSettingsRef.current = true;
        lastSyncedRef.current = current;
      }
      return;
    }

    const last = lastSyncedRef.current;
    if (
      last &&
      last.dayWindowStartHour === current.dayWindowStartHour &&
      last.dayWindowEndHour === current.dayWindowEndHour &&
      last.defaultDurationMinutes === current.defaultDurationMinutes
    ) {
      return;
    }

    lastSyncedRef.current = current;
    setSettingsMutate({
      timezone: userSettings.timezone,
      dayWindowStartHour: current.dayWindowStartHour,
      dayWindowEndHour: current.dayWindowEndHour,
      defaultDurationMinutes: current.defaultDurationMinutes,
      calendarSyncProviders:
        userSettings.calendarSyncProviders?.length
          ? userSettings.calendarSyncProviders
          : ['GOOGLE'],
      llmProvider: userSettings.llmProvider ?? 'NONE',
      openaiApiKey: userSettings.openaiApiKey ?? null,
      lmStudioUrl: userSettings.lmStudioUrl ?? 'http://localhost:1234',
    });
  }, [isAuthenticated, userSettings, dayStart, dayEnd, defaultDuration, setSettingsMutate]);

  // Make dragging/resizing more reliable across mouse/touch
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    })
  );

  // Tasks and events for the current visible range (simplified for now)
  const tasksQ = api.task.list.useQuery(undefined, { enabled: !!session });
  const eventsQ = api.event.listRange.useQuery(undefined, { enabled: !!session });
  const suggestionMutation = api.task.scheduleSuggestions.useMutation();

  const tasksData = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);
  const eventsData = useMemo(() => eventsQ.data ?? [], [eventsQ.data]);
  const [eventsLocal, setEventsLocal] = useState<Event[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<ScheduleSuggestion[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedBacklogIds, setSelectedBacklogIds] = useState<Set<string>>(new Set());
  const hasInitializedBacklogSelection = useRef(false);

  // Keep local, optimistic copy of events for immediate UI updates
  useEffect(() => {
    setEventsLocal(eventsQ.data ?? []);
  }, [eventsQ.data]);

  const backlog = useMemo(() => {
    const scheduledTaskIds = new Set(eventsData.map((e) => e.taskId));
    return tasksData.filter((t) => !scheduledTaskIds.has(t.id));
  }, [tasksData, eventsData]);

  useEffect(() => {
    setSelectedBacklogIds((prev) => {
      const available = new Set(backlog.map((task) => task.id));
      const next = new Set<string>();
      for (const id of prev) {
        if (available.has(id)) {
          next.add(id);
        }
      }
      if (!hasInitializedBacklogSelection.current) {
        if (available.size === 0) {
          return next;
        }
        hasInitializedBacklogSelection.current = true;
        return new Set(available);
      }
      if (available.size === 0) {
        hasInitializedBacklogSelection.current = false;
        return next;
      }
      return next;
    });
  }, [backlog]);

  useEffect(() => {
    if (
      selectedBacklogIds.size > 0 &&
      aiError &&
      aiError.toLowerCase().includes('select at least one backlog task')
    ) {
      setAiError(null);
    }
  }, [selectedBacklogIds, aiError]);

  const suggestionFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }),
    [],
  );

  const ITEM_SIZE = 48;

  useEffect(() => {
    if (eventsData?.[0]?.startAt) {
      setBaseDate(new Date(eventsData[0].startAt));
    }
  }, [eventsData]);

  const changeDate = React.useCallback((delta: number) => {
    if (delta === 0) {
      setBaseDate(new Date());
      return;
    }
    setBaseDate((prev) => {
      const d = new Date(prev);
      if (view === 'day') {
        d.setDate(d.getDate() + delta);
      } else if (view === 'week') {
        d.setDate(d.getDate() + delta * 7);
      } else {
        d.setDate(1);
        d.setMonth(d.getMonth() + delta);
      }
      return d;
    });
  }, [view]);

  const focusStart = api.focus.start.useMutation({
    onSuccess: async () => {
      // no-op: focus router has no status query to invalidate
    },
  });
  const focusStop = api.focus.stop.useMutation({
    onSuccess: async () => {
      // no-op: focus router has no status query to invalidate
    },
  });
  const focusStartMutate = React.useMemo(() => focusStart.mutate, [focusStart]);
  const focusStopMutate = React.useMemo(() => focusStop.mutate, [focusStop]);
  const schedule = api.event.schedule.useMutation({
    onSuccess: async (result) => {
      if (result?.syncWarnings?.length) {
        toast.info(result.syncWarnings[0] ?? 'Event saved locally, but calendar sync reported warnings.');
      }
      try {
        await utils.event.listRange.invalidate();
        await utils.task.list.invalidate();
      } catch {}
    },
  });
  const move = api.event.move.useMutation({
    onSuccess: async (result) => {
      if (result?.syncWarnings?.length) {
        toast.info(result.syncWarnings[0] ?? 'Event moved locally, but calendar sync reported warnings.');
      }
      try {
        await utils.event.listRange.invalidate();
      } catch {}
    },
  });

  const scheduleMutate = schedule.mutate;
  const scheduleWithPrefs = React.useCallback(
    (args: { taskId: string; startAt: Date; durationMinutes: number }) => {
      scheduleMutate({ ...args, dayWindowStartHour: dayStart, dayWindowEndHour: dayEnd });
    },
    [scheduleMutate, dayStart, dayEnd]
  );

  const requestSuggestions = React.useCallback(async () => {
    if (selectedBacklogIds.size === 0) {
      setAiError('Select at least one backlog task before generating suggestions.');
      return;
    }
    try {
      setAiError(null);
      const result = await suggestionMutation.mutateAsync({
        taskIds: Array.from(selectedBacklogIds),
      });
      setAiSuggestions(result.suggestions);
    } catch (err) {
      console.error(err);
      setAiError(err instanceof Error ? err.message : 'Failed to generate suggestions');
    }
  }, [selectedBacklogIds, suggestionMutation]);

  const toggleBacklogSelection = React.useCallback((taskId: string) => {
    setSelectedBacklogIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const acceptSuggestion = React.useCallback(
    (suggestion: ScheduleSuggestion) => {
      const durationMinutes = Math.max(
        1,
        Math.round((suggestion.endAt.getTime() - suggestion.startAt.getTime()) / 60000),
      );
      setAiSuggestions((prev) => prev.filter((s) => s.taskId !== suggestion.taskId));
      scheduleWithPrefs({
        taskId: suggestion.taskId,
        startAt: new Date(suggestion.startAt),
        durationMinutes,
      });
    },
    [scheduleWithPrefs],
  );
  const moveMutateFn = move.mutate;
  const moveWithPrefs = React.useCallback(
    (args: { eventId: string; startAt: Date; endAt: Date }) => {
      moveMutateFn({ ...args, dayWindowStartHour: dayStart, dayWindowEndHour: dayEnd });
    },
    [moveMutateFn, dayStart, dayEnd]
  );

  const createTask = api.task.create.useMutation();

  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [focusedSince, setFocusedSince] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);
  const elapsedByTaskRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (focusedSince == null) return;
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - (focusedSince as number));
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [focusedSince]);

  // On unmount, ensure focus is stopped (pauses session)
  useEffect(() => {
    return () => {
      if (focusedTaskId) {
        try { focusStopMutate({ taskId: focusedTaskId }); } catch {}
      }
    };
  }, [focusedTaskId, focusStopMutate]);

  const toggleFocus = React.useCallback((taskId: string) => {
    if (focusedTaskId === taskId) {
      // store elapsed so resuming continues
      elapsedByTaskRef.current[taskId] = elapsed;
      setFocusedTaskId(null);
      setFocusedSince(null);
      focusStopMutate({ taskId });
    } else {
      setFocusedTaskId(taskId);
      const prev = elapsedByTaskRef.current[taskId] ?? 0;
      setFocusedSince(Date.now() - prev);
      setElapsed(prev);
      focusStartMutate({ taskId });
    }
  }, [focusedTaskId, elapsed, focusStartMutate, focusStopMutate]);

  // Global key handler to support Space toggling focus on a focused backlog task button
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Space') {
        const el = document.activeElement as HTMLElement | null;
        const id = el?.getAttribute?.('data-task-id');
        if (id) {
          e.preventDefault();
          toggleFocus(id);
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [toggleFocus]);

  if (tasksQ.error || eventsQ.error) {
    return (
      <main className="p-4">
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-4">
          {tasksQ.error && <p>Failed to load tasks: {String(tasksQ.error.message)}</p>}
          {eventsQ.error && <p>Failed to load events: {String(eventsQ.error.message)}</p>}
          <button
            type="button"
            className="mt-2 rounded border px-3 py-1"
            onClick={() => {
              try { tasksQ.refetch(); } catch {}
              try { eventsQ.refetch(); } catch {}
            }}
          >Retry</button>
        </div>
      </main>
    );
  }

  const ViewTabs = (
    <div role="tablist" aria-label="Calendar view" className="flex gap-2">
      {(['day', 'week', 'month'] as ViewMode[]).map((v) => (
        <button
          key={v}
          role="tab"
          aria-selected={view === v}
          className={`px-3 py-1 text-sm border-b-2 ${view === v ? 'border-black dark:border-white' : 'border-transparent'}`}
          onClick={() => setView(v)}
        >
          {v[0].toUpperCase() + v.slice(1)}
        </button>
      ))}
    </div>
  );

  if (tasksQ.isLoading || eventsQ.isLoading) {
    return (
      <ErrorBoundary fallback={<main>Failed to load calendar</main>}>
        <main className="flex items-center justify-center p-4">
          <div
            aria-label="loading calendar"
            role="status"
            className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-black dark:border-white/10 dark:border-t-white"
          />
        </main>
      </ErrorBoundary>
    );
  }

  if (focusedTaskId) {
    const task = tasksData.find((t) => t.id === focusedTaskId);
    return (
      <main className="space-y-4">
        <header className="flex items-center justify-end gap-2">
          <Link
            href="/"
            className="rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            title="Back to Home"
          >
            Home
          </Link>
          {/* Account menu available in the global nav bar */}
        </header>
        {ViewTabs}
        <section className="p-4 rounded border">
          <h2 className="text-xl font-semibold">Focusing: {task?.title}</h2>
          <p
            role="timer"
            aria-live="polite"
            aria-label="Elapsed focus time"
          >
            {Math.floor(elapsed / 1000)}s
          </p>
          <button className="mt-2 px-3 py-1 border rounded" onClick={() => toggleFocus(focusedTaskId!)}>Unfocus</button>
        </section>
      </main>
    );
  }

  return (
    <ErrorBoundary fallback={<main>Failed to load calendar</main>}>
    <main className="grid w-full grid-cols-1 gap-4 md:grid-cols-4">
      <header className="flex items-center justify-between gap-2 md:col-span-4">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            title="Back to Home"
          >
            Home
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous"
              className="rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              onClick={() => changeDate(-1)}
            >
              Prev
            </button>
            <button
              type="button"
              className={`rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5 ${
                baseDate.toDateString() === new Date().toDateString()
                  ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                  : ''
              }`}
              onClick={() => setBaseDate(new Date())}
              aria-current={baseDate.toDateString() === new Date().toDateString() ? 'date' : undefined}
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next"
              className="rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              onClick={() => changeDate(1)}
            >
              Next
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ViewTabs}
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            onClick={() => setShowSettings(true)}
          >
            Settings
          </button>
        </div>
      </header>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={(e: DragEndEvent) => {
          const { active, over } = e;
          if (!over) return;
          const aid = String(active.id);
          const oid = String(over.id);
          if (aid.startsWith('task-') && oid.startsWith('cell-')) {
            const taskId = aid.slice('task-'.length);
            const iso = oid.slice('cell-'.length);
            const startAt = new Date(iso);
            scheduleWithPrefs({ taskId, startAt, durationMinutes: defaultDuration });
            return;
          }
          if (aid.startsWith('event-') && oid.startsWith('cell-')) {
            const eventId = aid.slice('event-'.length);
            const iso = oid.slice('cell-'.length);
            const startAt = new Date(iso);
            const ev = eventsLocal.find((e) => e.id === eventId);
            if (!ev) return;
            const durationMin = calculateDurationMinutes(ev.startAt, ev.endAt);
            const endAt = new Date(startAt.getTime() + durationMin * 60000);
            // optimistic update
            setEventsLocal((prev) => prev.map((x) => x.id === eventId ? { ...x, startAt, endAt } : x));
            moveWithPrefs({ eventId, startAt, endAt });
            return;
          }
          if (aid.startsWith('event-resize-start-') && oid.startsWith('cell-')) {
            const eventId = aid.slice('event-resize-start-'.length);
            const iso = oid.slice('cell-'.length);
            let at = new Date(iso);
            const ev = eventsLocal.find((e) => e.id === eventId);
            if (!ev) return;
            let startAt = new Date(ev.startAt);
            const endAt = new Date(ev.endAt);
            if (at >= endAt) at = new Date(endAt.getTime() - 15 * 60000);
            startAt = at;
            // optimistic update
            setEventsLocal((prev) => prev.map((x) => x.id === eventId ? { ...x, startAt } : x));
            moveWithPrefs({ eventId, startAt, endAt });
            return;
          }
          if (aid.startsWith('event-resize-end-') && oid.startsWith('cell-')) {
            const eventId = aid.slice('event-resize-end-'.length);
            const iso = oid.slice('cell-'.length);
            let at = new Date(iso);
            const ev = eventsLocal.find((e) => e.id === eventId);
            if (!ev) return;
            const startAt = new Date(ev.startAt);
            let endAt = new Date(ev.endAt);
            if (at <= startAt) at = new Date(startAt.getTime() + 15 * 60000);
            endAt = at;
            // optimistic update
            setEventsLocal((prev) => prev.map((x) => x.id === eventId ? { ...x, endAt } : x));
            moveWithPrefs({ eventId, startAt, endAt });
            return;
          }
        }}
      >
      <div className="w-full space-y-3 self-start md:col-span-1">
        <h2 className="font-semibold">Backlog</h2>
        <ul className="space-y-2">
          {backlog.map((t) => {
            const labelId = `backlog-task-${t.id}-label`;
            const descId = t.notes ? `backlog-task-${t.id}-desc` : undefined;
            const checkboxId = `backlog-select-${t.id}`;
            return (
              <li key={t.id} className="flex items-center gap-2">
                <input
                  id={checkboxId}
                  type="checkbox"
                  aria-label={`Select ${t.title}`}
                  checked={selectedBacklogIds.has(t.id)}
                  onChange={() => toggleBacklogSelection(t.id)}
                  className="h-4 w-4 rounded border border-black/30 text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-white/20 dark:bg-slate-900"
                />
                <DraggableTask
                  id={t.id}
                  title={t.title}
                  onSpaceKey={() => toggleFocus(t.id)}
                  labelId={labelId}
                  description={t.notes ?? undefined}
                  descriptionId={descId}
                />
                <button
                  type="button"
                  aria-label={`focus ${t.title}`}
                  className="rounded border px-2 py-1 text-sm"
                  onClick={() => toggleFocus(t.id)}
                >
                  Focus
                </button>
              </li>
            );
          })}
        </ul>

        {backlog.length > 0 && selectedBacklogIds.size === 0 && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Select at least one backlog task to enable AI suggestions.
          </p>
        )}

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">AI suggestions</h3>
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/10"
              onClick={() => void requestSuggestions()}
              disabled={suggestionMutation.isPending || selectedBacklogIds.size === 0}
            >
              {suggestionMutation.isPending ? 'Generating…' : 'Generate'}
            </button>
          </div>
          {aiError && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {aiError}
            </p>
          )}
          {aiSuggestions.length > 0 ? (
            <ul className="space-y-2" data-testid="ai-suggestions-list">
              {aiSuggestions.map((s) => {
                const task = tasksData.find((t) => t.id === s.taskId);
                return (
                  <li
                    key={s.taskId}
                    className="rounded border border-dashed px-3 py-2 text-xs dark:border-white/20"
                    data-testid="ai-suggestion-item"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{task?.title ?? s.taskId}</div>
                        <div className="text-xs text-muted-foreground">
                          {suggestionFormatter.format(new Date(s.startAt))} – {suggestionFormatter.format(new Date(s.endAt))} ·{' '}
                          {s.origin}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/10"
                        onClick={() => acceptSuggestion(s)}
                      >
                        Accept
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No AI suggestions yet.</p>
          )}
        </div>

        {/* Test-only helper to simulate a drop action */}
        {backlog[0] && (
          <button
            type="button"
            aria-label="simulate-drop-unscheduled"
            className="hidden"
            onClick={() => {
              const now = new Date();
              scheduleWithPrefs({ taskId: backlog[0].id, startAt: now, durationMinutes: defaultDuration });
            }}
          >Simulate</button>
        )}
        {eventsData?.[0] && (
          <button
            type="button"
            aria-label="simulate-move-event"
            className="hidden"
            onClick={() => {
              const ev = eventsData[0];
              const newStart = new Date(new Date(ev.startAt).getTime() + 60 * 60000);
              const durationMin = calculateDurationMinutes(ev.startAt, ev.endAt);
              const newEnd = new Date(newStart.getTime() + durationMin * 60000);
              moveWithPrefs({ eventId: ev.id, startAt: newStart, endAt: newEnd });
            }}
          >Simulate Move</button>
        )}
      </div>
      <div className="w-full md:col-span-3">
        <div data-testid="calendar-grid">
          <CalendarGrid
            view={view}
            startOfWeek={baseDate}
            workStartHour={dayStart}
            workEndHour={dayEnd}
            onDropTask={(taskId, startAt) => {
              scheduleWithPrefs({ taskId, startAt, durationMinutes: defaultDuration });
            }}
            onMoveEvent={(eventId, startAt) => {
              const ev = eventsData.find((e) => e.id === eventId);
              if (!ev) return;
              const durationMin = calculateDurationMinutes(ev.startAt, ev.endAt);
              const endAt = new Date(startAt.getTime() + durationMin * 60000);
              moveWithPrefs({ eventId, startAt, endAt });
            }}
            onResizeEvent={(eventId, edge, at) => {
              const ev = eventsData.find((e) => e.id === eventId);
              if (!ev) return;
              let startAt = new Date(ev.startAt);
              let endAt = new Date(ev.endAt);
              if (edge === 'start') {
                if (at >= endAt) at = new Date(endAt.getTime() - 15 * 60000);
                startAt = at;
              } else {
                if (at <= startAt) at = new Date(startAt.getTime() + 15 * 60000);
                endAt = at;
              }
              // optimistic update
              setEventsLocal((prev) => prev.map((x) => x.id === eventId ? { ...x, startAt, endAt } : x));
              moveWithPrefs({ eventId, startAt, endAt });
            }}
            onClickSlot={(startAt) => {
              setNewTaskStart(startAt);
              setShowCreate(true);
            }}
            events={eventsLocal.map((e) => {
              const t = tasksData.find((x) => x.id === e.taskId);
              return { ...e, title: t?.title };
            })}
          />
        </div>
      </div>
      {/* Test-only helper to simulate resize */}
      {eventsData?.[0] && (
        <button
          type="button"
          aria-label="simulate-resize-event"
          className="hidden"
          onClick={() => {
            const ev = eventsLocal[0];
            const startAt = new Date(ev.startAt);
            const newEnd = new Date(startAt.getTime() + 120 * 60000); // extend to 2h total
            setEventsLocal((prev) => prev.map((x) => x.id === ev.id ? { ...x, endAt: newEnd } : x));
              moveWithPrefs({ eventId: ev.id, startAt, endAt: newEnd });
          }}
        >Simulate Resize</button>
      )}
      </DndContext>
      <Modal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setNewTaskTitle('');
        }}
        title="New Task"
        footer={
          <>
            <Button
              variant="tertiary"
              onClick={() => {
                setShowCreate(false);
                setNewTaskTitle('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const title = newTaskTitle.trim();
                if (!title) return;
                createTask.mutate(
                  { title },
                  {
                    onSuccess: async (task) => {
                      if (newTaskStart) {
                        scheduleWithPrefs({
                          taskId: task.id,
                          startAt: newTaskStart,
                          durationMinutes: defaultDuration,
                        });
                      }
                      try {
                        await utils.task.list.invalidate();
                      } catch {}
                      setShowCreate(false);
                      setNewTaskTitle('');
                      setNewTaskStart(null);
                    },
                  }
                );
              }}
            >
              Create
            </Button>
          </>
        }
      >
        <label className="block text-sm">
          <span>Title</span>
          <Input
            aria-label="Task title"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
          />
        </label>
      </Modal>
      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="Calendar Settings"
        footer={
          <Button type="button" onClick={() => setShowSettings(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-3">
          <label className="block text-sm">
            <span>Day start</span>
            <Input
              type="number"
              min={0}
              max={23}
              value={dayStart}
              onChange={(e) => setDayStart(Number(e.target.value))}
            />
          </label>
          <label className="block text-sm">
            <span>Day end</span>
            <Input
              type="number"
              min={1}
              max={24}
              value={dayEnd}
              onChange={(e) => setDayEnd(Number(e.target.value))}
            />
          </label>
          <label className="block text-sm">
            <span>Default duration (minutes)</span>
            <Input
              type="number"
              min={1}
              value={defaultDuration}
              onChange={(e) => setDefaultDuration(Number(e.target.value))}
            />
          </label>
        </div>
      </Modal>
    </main>
    </ErrorBoundary>
  );
}
