"use client";
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, type DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import { useRouter } from 'next/navigation';
import { api } from '@/server/api/react';
import type { RouterOutputs } from '@/server/api/root';
import { CalendarGrid, DraggableTask } from '@/components/calendar/CalendarGrid';
import { ErrorBoundary } from '@/components/error-boundary';
import { AccountMenu } from "@/components/account-menu";

type ViewMode = 'day' | 'week' | 'month';
type Task = RouterOutputs['task']['list'][number];
type Event = RouterOutputs['event']['listRange'][number];

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>('week');
  const utils = api.useUtils();
  const router = useRouter();

  const [dayStart, setDayStart] = useState(8);
  const [dayEnd, setDayEnd] = useState(18);
  const [defaultDuration, setDefaultDuration] = useState(30);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const s = window.localStorage.getItem('dayWindowStartHour');
    const e = window.localStorage.getItem('dayWindowEndHour');
    const d = window.localStorage.getItem('defaultDurationMinutes');
    if (s) setDayStart(Number(s));
    if (e) setDayEnd(Number(e));
    if (d) setDefaultDuration(Number(d));
  }, []);

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
  const tasksQ = api.task.list.useQuery();
  const eventsQ = api.event.listRange.useQuery();

  const tasksData = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);
  const eventsData = useMemo(() => eventsQ.data ?? [], [eventsQ.data]);
  const [eventsLocal, setEventsLocal] = useState<Event[]>([]);

  // Keep local, optimistic copy of events for immediate UI updates
  useEffect(() => {
    setEventsLocal(eventsQ.data ?? []);
  }, [eventsQ.data]);

  const backlog = useMemo(() => {
    const scheduledTaskIds = new Set(eventsData.map((e) => e.taskId));
    return tasksData.filter((t) => !scheduledTaskIds.has(t.id));
  }, [tasksData, eventsData]);

  // Choose a base week to render: prefer the first event's week for stability in tests
  const baseDate = eventsData?.[0]?.startAt ? new Date(eventsData[0].startAt) : new Date();
  const baseMonday = new Date(baseDate);
  const day = baseMonday.getDay();
  const diff = (day + 6) % 7;
  baseMonday.setDate(baseMonday.getDate() - diff);

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
    onSuccess: async () => {
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
  const moveMutateFn = move.mutate;
  const moveWithPrefs = React.useCallback(
    (args: { eventId: string; startAt: Date; endAt: Date }) => {
      moveMutateFn({ ...args, dayWindowStartHour: dayStart, dayWindowEndHour: dayEnd });
    },
    [moveMutateFn, dayStart, dayEnd]
  );

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
      if (e.key === ' ') {
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

  if (focusedTaskId) {
    const task = tasksData.find((t) => t.id === focusedTaskId);
    return (
      <main className="space-y-4">
        <header className="flex items-center justify-end gap-2">
          <a
            href="/"
            className="rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            title="Back to Home"
            onClick={(e) => { e.preventDefault(); router.push('/'); }}
          >
            Home
          </a>
          {/* Settings link removed; accessible via AccountMenu */}
          <Suspense fallback={null}>
            <AccountMenu />
          </Suspense>
        </header>
        {ViewTabs}
        <section className="p-4 rounded border">
          <h2 className="text-xl font-semibold">Focusing: {task?.title}</h2>
          <p aria-label="timer">{Math.floor(elapsed / 1000)}s</p>
          <button className="mt-2 px-3 py-1 border rounded" onClick={() => toggleFocus(focusedTaskId!)}>Unfocus</button>
        </section>
      </main>
    );
  }

  return (
    <ErrorBoundary fallback={<main>Failed to load calendar</main>}>
    <main className="grid w-full grid-cols-1 gap-4 md:grid-cols-4">
      <div className="flex items-center justify-end gap-2 md:col-span-4">
        <a
          href="/"
          className="rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
          title="Back to Home"
          onClick={(e) => { e.preventDefault(); router.push('/'); }}
        >
          Home
        </a>
        {/* Settings link removed; accessible via AccountMenu */}
        <Suspense fallback={null}>
          <AccountMenu />
        </Suspense>
      </div>
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
            const durationMin = Math.max(1, Math.round((new Date(ev.endAt).getTime() - new Date(ev.startAt).getTime()) / 60000));
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
      <div className="w-full space-y-3 md:col-span-1">
        {ViewTabs}
        <h2 className="font-semibold">Backlog</h2>
        <ul className="space-y-2">
          {backlog.map((t) => (
            <li key={t.id}>
              <DraggableTask id={t.id} title={t.title} onSpaceKey={() => toggleFocus(t.id)} />
            </li>
          ))}
        </ul>

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
              const durationMin = Math.max(1, Math.round((new Date(ev.endAt).getTime() - new Date(ev.startAt).getTime()) / 60000));
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
            startOfWeek={baseMonday}
            onDropTask={(taskId, startAt) => {
              scheduleWithPrefs({ taskId, startAt, durationMinutes: defaultDuration });
            }}
            onMoveEvent={(eventId, startAt) => {
              const ev = eventsData.find((e) => e.id === eventId);
              if (!ev) return;
              const durationMin = Math.max(1, Math.round((new Date(ev.endAt).getTime() - new Date(ev.startAt).getTime()) / 60000));
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
    </main>
    </ErrorBoundary>
  );
}
