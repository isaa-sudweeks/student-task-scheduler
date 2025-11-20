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
  const [focusWorkMinutes, setFocusWorkMinutes] = useState(25);
  const [focusBreakMinutes, setFocusBreakMinutes] = useState(5);
  const [focusCycleCount, setFocusCycleCount] = useState(4);
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
    focusWorkMinutes: number;
    focusBreakMinutes: number;
    focusCycleCount: number;
  } | null>(null);
  const hasLoadedServerSettingsRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const s = parseStoredNumber(window.localStorage.getItem('dayWindowStartHour'));
    const e = parseStoredNumber(window.localStorage.getItem('dayWindowEndHour'));
    const d = parseStoredNumber(window.localStorage.getItem('defaultDurationMinutes'));
    const fw = parseStoredNumber(window.localStorage.getItem('focusWorkMinutes'));
    const fb = parseStoredNumber(window.localStorage.getItem('focusBreakMinutes'));
    const fc = parseStoredNumber(window.localStorage.getItem('focusCycleCount'));
    if (s != null) setDayStart(s);
    if (e != null) setDayEnd(e);
    if (d != null) setDefaultDuration(d);
    if (fw != null) setFocusWorkMinutes(fw);
    if (fb != null) setFocusBreakMinutes(fb);
    if (fc != null) setFocusCycleCount(fc);
  }, [parseStoredNumber]);
  useEffect(() => {
    if (!userSettings) return;
    hasLoadedServerSettingsRef.current = false;
    setDayStart(userSettings.dayWindowStartHour);
    setDayEnd(userSettings.dayWindowEndHour);
    setDefaultDuration(userSettings.defaultDurationMinutes);
    setFocusWorkMinutes(userSettings.focusWorkMinutes);
    setFocusBreakMinutes(userSettings.focusBreakMinutes);
    setFocusCycleCount(userSettings.focusCycleCount);
  }, [userSettings]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('dayWindowStartHour', String(dayStart));
    window.localStorage.setItem('dayWindowEndHour', String(dayEnd));
    window.localStorage.setItem('defaultDurationMinutes', String(defaultDuration));
    window.localStorage.setItem('focusWorkMinutes', String(focusWorkMinutes));
    window.localStorage.setItem('focusBreakMinutes', String(focusBreakMinutes));
    window.localStorage.setItem('focusCycleCount', String(focusCycleCount));
  }, [dayStart, dayEnd, defaultDuration, focusWorkMinutes, focusBreakMinutes, focusCycleCount]);

  useEffect(() => {
    if (!isAuthenticated || !userSettings) return;

    const current = {
      dayWindowStartHour: dayStart,
      dayWindowEndHour: dayEnd,
      defaultDurationMinutes: defaultDuration,
      focusWorkMinutes,
      focusBreakMinutes,
      focusCycleCount,
    };

    const matchesServer =
      current.dayWindowStartHour === userSettings.dayWindowStartHour &&
      current.dayWindowEndHour === userSettings.dayWindowEndHour &&
      current.defaultDurationMinutes === userSettings.defaultDurationMinutes &&
      current.focusWorkMinutes === userSettings.focusWorkMinutes &&
      current.focusBreakMinutes === userSettings.focusBreakMinutes &&
      current.focusCycleCount === userSettings.focusCycleCount;

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
      last.defaultDurationMinutes === current.defaultDurationMinutes &&
      last.focusWorkMinutes === current.focusWorkMinutes &&
      last.focusBreakMinutes === current.focusBreakMinutes &&
      last.focusCycleCount === current.focusCycleCount
    ) {
      return;
    }

    lastSyncedRef.current = current;
    setSettingsMutate({
      timezone: userSettings.timezone,
      dayWindowStartHour: current.dayWindowStartHour,
      dayWindowEndHour: current.dayWindowEndHour,
      defaultDurationMinutes: current.defaultDurationMinutes,
      focusWorkMinutes: current.focusWorkMinutes,
      focusBreakMinutes: current.focusBreakMinutes,
      focusCycleCount: current.focusCycleCount,
      googleSyncEnabled: userSettings.googleSyncEnabled,
      llmProvider: userSettings.llmProvider ?? 'NONE',
      openaiApiKey: userSettings.openaiApiKey ?? null,
      lmStudioUrl: userSettings.lmStudioUrl ?? 'http://localhost:1234',
    });
  }, [
    isAuthenticated,
    userSettings,
    dayStart,
    dayEnd,
    defaultDuration,
    focusWorkMinutes,
    focusBreakMinutes,
    focusCycleCount,
    setSettingsMutate,
  ]);

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
  const timeFormatter = React.useMemo(
    () => new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }),
    [],
  );
  const formatDuration = React.useCallback((ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

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
      if (result?.googleSyncWarning) {
        toast.info('Event saved locally, but Google Calendar sync failed.');
      }
      try {
        await utils.event.listRange.invalidate();
        await utils.task.list.invalidate();
      } catch {}
    },
  });
  const move = api.event.move.useMutation({
    onSuccess: async () => {
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
  const [focusPhase, setFocusPhase] = useState<'idle' | 'work' | 'break'>('idle');
  const [focusCycle, setFocusCycle] = useState(0);
  const [phaseStartedAt, setPhaseStartedAt] = useState<number | null>(null);
  const [phaseEndsAt, setPhaseEndsAt] = useState<number | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const phaseTimeoutRef = useRef<number | null>(null);
  const focusCompleteInterval = api.focus.completeInterval.useMutation();
  const focusCompleteMutate = React.useMemo(() => focusCompleteInterval.mutateAsync, [focusCompleteInterval]);

  useEffect(() => {
    if (!focusedTaskId) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [focusedTaskId]);

  const resetFocusState = React.useCallback(() => {
    if (phaseTimeoutRef.current) {
      window.clearTimeout(phaseTimeoutRef.current);
      phaseTimeoutRef.current = null;
    }
    setFocusPhase('idle');
    setFocusCycle(0);
    setPhaseStartedAt(null);
    setPhaseEndsAt(null);
    setSessionStartedAt(null);
    setFocusedTaskId(null);
    setNowMs(Date.now());
  }, []);

  const handlePhaseComplete = React.useCallback(() => {
    if (!focusedTaskId || phaseStartedAt == null || phaseEndsAt == null) return;
    const startedAt = new Date(phaseStartedAt);
    const endedAt = new Date(phaseEndsAt);
    void focusCompleteMutate({
      taskId: focusedTaskId,
      type: focusPhase === 'break' ? 'BREAK' : 'WORK',
      startedAt,
      endedAt,
    }).catch((err) => {
      console.error('Failed to record focus interval', err);
    });
    if (focusPhase === 'work') {
      focusStopMutate({ taskId: focusedTaskId });
      const completedCycles = focusCycle + 1;
      setFocusCycle(completedCycles);
      if (completedCycles >= focusCycleCount) {
        resetFocusState();
        return;
      }
      const nextStart = Date.now();
      setFocusPhase('break');
      setPhaseStartedAt(nextStart);
      setPhaseEndsAt(nextStart + focusBreakMinutes * 60000);
      setNowMs(nextStart);
    } else if (focusPhase === 'break') {
      const nextStart = Date.now();
      setFocusPhase('work');
      setPhaseStartedAt(nextStart);
      setPhaseEndsAt(nextStart + focusWorkMinutes * 60000);
      setNowMs(nextStart);
      focusStartMutate({ taskId: focusedTaskId });
    }
  }, [
    focusBreakMinutes,
    focusCompleteMutate,
    focusCycle,
    focusCycleCount,
    focusPhase,
    focusStartMutate,
    focusStopMutate,
    focusWorkMinutes,
    focusedTaskId,
    phaseEndsAt,
    phaseStartedAt,
    resetFocusState,
  ]);

  useEffect(() => {
    if (!focusedTaskId || phaseEndsAt == null || phaseStartedAt == null) return;
    const timeout = window.setTimeout(() => {
      handlePhaseComplete();
    }, Math.max(0, phaseEndsAt - Date.now()));
    phaseTimeoutRef.current = timeout;
    return () => {
      window.clearTimeout(timeout);
      if (phaseTimeoutRef.current === timeout) {
        phaseTimeoutRef.current = null;
      }
    };
  }, [focusedTaskId, phaseEndsAt, phaseStartedAt, handlePhaseComplete]);

  useEffect(() => {
    return () => {
      if (phaseTimeoutRef.current) {
        window.clearTimeout(phaseTimeoutRef.current);
        phaseTimeoutRef.current = null;
      }
    };
  }, []);

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
      if (focusPhase === 'work') {
        focusStopMutate({ taskId });
      }
      resetFocusState();
      return;
    }
    if (focusedTaskId && focusedTaskId !== taskId) {
      if (focusPhase === 'work') {
        focusStopMutate({ taskId: focusedTaskId });
      }
      resetFocusState();
    }
    const now = Date.now();
    setFocusedTaskId(taskId);
    setFocusPhase('work');
    setFocusCycle(0);
    setPhaseStartedAt(now);
    setPhaseEndsAt(now + focusWorkMinutes * 60000);
    setSessionStartedAt(now);
    setNowMs(now);
    focusStartMutate({ taskId });
  }, [
    focusPhase,
    focusStartMutate,
    focusStopMutate,
    focusWorkMinutes,
    focusedTaskId,
    resetFocusState,
  ]);

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
    const timeRemainingMs = phaseEndsAt ? Math.max(0, phaseEndsAt - nowMs) : 0;
    const sessionElapsedMs = sessionStartedAt ? Math.max(0, nowMs - sessionStartedAt) : 0;
    const currentIntervalLabel =
      focusPhase === 'work'
        ? `Work interval ${Math.min(focusCycle + 1, focusCycleCount)} of ${focusCycleCount}`
        : focusPhase === 'break'
        ? `Break before interval ${Math.min(focusCycle + 1, focusCycleCount)}`
        : 'Session paused';
    let nextBreakAt: Date | null = null;
    if (phaseEndsAt != null) {
      if (focusPhase === 'work' && focusCycle + 1 < focusCycleCount) {
        nextBreakAt = new Date(phaseEndsAt);
      } else if (focusPhase === 'break' && focusCycle < focusCycleCount - 1) {
        nextBreakAt = new Date(phaseEndsAt + focusWorkMinutes * 60000);
      }
    }
    let sessionCompletionAt: Date | null = null;
    if (phaseEndsAt != null && focusPhase !== 'idle') {
      let remaining = Math.max(0, phaseEndsAt - nowMs);
      if (focusPhase === 'work') {
        if (focusCycle + 1 < focusCycleCount) {
          remaining += focusBreakMinutes * 60000;
        }
        const remainingWorkIntervals = Math.max(0, focusCycleCount - (focusCycle + 1));
        if (remainingWorkIntervals > 0) {
          remaining += remainingWorkIntervals * focusWorkMinutes * 60000;
          const futureBreaks = Math.max(0, remainingWorkIntervals - 1);
          remaining += futureBreaks * focusBreakMinutes * 60000;
        }
      } else if (focusPhase === 'break') {
        const remainingWorkIntervals = Math.max(0, focusCycleCount - focusCycle);
        if (remainingWorkIntervals > 0) {
          remaining += remainingWorkIntervals * focusWorkMinutes * 60000;
          const futureBreaks = Math.max(0, remainingWorkIntervals - 1);
          remaining += futureBreaks * focusBreakMinutes * 60000;
        }
      }
      if (remaining > 0) {
        sessionCompletionAt = new Date(nowMs + remaining);
      }
    }
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
          <p className="text-sm text-muted-foreground">{currentIntervalLabel}</p>
          <p
            role="timer"
            aria-live="polite"
            aria-label="Time remaining for current focus interval"
            className="mt-2 text-lg font-medium"
          >
            Time remaining: {formatDuration(timeRemainingMs)}
          </p>
          <p className="text-sm text-muted-foreground">Session elapsed: {formatDuration(sessionElapsedMs)}</p>
          {nextBreakAt && (
            <p className="text-sm">Next break at {timeFormatter.format(nextBreakAt)}</p>
          )}
          {sessionCompletionAt && (
            <p className="text-sm">Session completes at {timeFormatter.format(sessionCompletionAt)}</p>
          )}
          <button className="mt-4 px-3 py-1 border rounded" onClick={() => toggleFocus(focusedTaskId!)}>End session</button>
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
          <label className="block text-sm">
            <span>Focus work duration (minutes)</span>
            <Input
              type="number"
              min={5}
              value={focusWorkMinutes}
              onChange={(e) => setFocusWorkMinutes(Number(e.target.value))}
            />
          </label>
          <label className="block text-sm">
            <span>Focus break duration (minutes)</span>
            <Input
              type="number"
              min={1}
              value={focusBreakMinutes}
              onChange={(e) => setFocusBreakMinutes(Number(e.target.value))}
            />
          </label>
          <label className="block text-sm">
            <span>Focus intervals per session</span>
            <Input
              type="number"
              min={1}
              value={focusCycleCount}
              onChange={(e) => setFocusCycleCount(Number(e.target.value))}
            />
          </label>
        </div>
      </Modal>
    </main>
    </ErrorBoundary>
  );
}
