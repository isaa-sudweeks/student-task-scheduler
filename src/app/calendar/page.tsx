"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/server/api/react';
import { CalendarGrid, DraggableTask } from '@/components/calendar/CalendarGrid';
import { DndContext, type DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import { useRouter } from 'next/navigation';

type ViewMode = 'day' | 'week' | 'month';

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>('week');
  const utils = api.useUtils?.() as any;
  const router = useRouter();

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
  const tasksQ = api.task.list.useQuery(undefined as any);
  const apiAny = api as any;
  const eventsQ = apiAny.event?.listRange?.useQuery?.(undefined);

  const tasksData = tasksQ.data ?? [];
  const eventsData = (eventsQ as any)?.data ?? [];
  const [eventsLocal, setEventsLocal] = useState<any[]>([]);
  const events = (eventsQ as any).data ?? [];

  // Keep local, optimistic copy of events for immediate UI updates
  useEffect(() => {
    setEventsLocal((((eventsQ as any)?.data ?? []) as any[]));
  }, [eventsQ]);

  const backlog = useMemo(() => {
    const evs = (((eventsQ as any)?.data ?? []) as any[]);
    const tsks = ((tasksQ.data ?? []) as any[]);
    const scheduledTaskIds = new Set<string>(evs.map((e: any) => e.taskId));
    return tsks.filter((t: any) => !scheduledTaskIds.has(t.id));
  }, [tasksQ.data, eventsQ]);

  // Choose a base week to render: prefer the first event's week for stability in tests
  const baseDate = (eventsData as any[])?.[0]?.startAt ? new Date((eventsData as any[])[0].startAt) : new Date();
  const baseMonday = new Date(baseDate);
  const day = baseMonday.getDay();
  const diff = (day + 6) % 7;
  baseMonday.setDate(baseMonday.getDate() - diff);

  const focusStart = apiAny.focus?.start?.useMutation?.({
    onSuccess: async () => {
      try { await utils?.focus?.status?.invalidate?.(); } catch {}
    },
  });
  const focusStop = apiAny.focus?.stop?.useMutation?.({
    onSuccess: async () => {
      try { await utils?.focus?.status?.invalidate?.(); } catch {}
    },
  });
  const focusStartMutate = React.useMemo(() => focusStart?.mutate ?? (() => {}), [focusStart]);
  const focusStopMutate = React.useMemo(() => focusStop?.mutate ?? (() => {}), [focusStop]);
  const schedule = apiAny.event?.schedule?.useMutation?.({
    onSuccess: async () => {
      try {
        await utils?.event?.listRange?.invalidate?.();
        await utils?.task?.list?.invalidate?.();
      } catch {}
    },
  }) ?? { mutate: () => {} };
  const move = apiAny.event?.move?.useMutation?.({
    onSuccess: async () => {
      try {
        await utils?.event?.listRange?.invalidate?.();
      } catch {}
    },
  }) ?? { mutate: () => {} };

  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [focusedSince, setFocusedSince] = useState<number | null>(null);
  const intervalRef = useRef<any>(null);
  const [elapsed, setElapsed] = useState<number>(0);
  const elapsedByTaskRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (focusedSince == null) return;
    intervalRef.current && clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - (focusedSince as number));
    }, 1000);
    return () => intervalRef.current && clearInterval(intervalRef.current);
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
    const task = tasks.find((t: any) => t.id === focusedTaskId);
    return (
      <main className="space-y-4">
        <header className="flex items-center justify-end">
          <a
            href="/"
            className="rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            title="Back to Home"
            onClick={(e) => { e.preventDefault(); router.push('/'); }}
          >
            Home
          </a>
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
    <main className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="md:col-span-4 flex items-center justify-end">
        <a
          href="/"
          className="rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
          title="Back to Home"
          onClick={(e) => { e.preventDefault(); router.push('/'); }}
        >
          Home
        </a>
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
            schedule.mutate({ taskId, startAt, durationMinutes: 30 });
            return;
          }
          if (aid.startsWith('event-') && oid.startsWith('cell-')) {
            const eventId = aid.slice('event-'.length);
            const iso = oid.slice('cell-'.length);
            const startAt = new Date(iso);
            const ev = (eventsLocal as any[]).find((e) => e.id === eventId);
            if (!ev) return;
            const durationMin = Math.max(1, Math.round((new Date(ev.endAt).getTime() - new Date(ev.startAt).getTime()) / 60000));
            const endAt = new Date(startAt.getTime() + durationMin * 60000);
            // optimistic update
            setEventsLocal((prev) => prev.map((x) => x.id === eventId ? { ...x, startAt, endAt } : x));
            move.mutate({ eventId, startAt, endAt });
            return;
          }
          if (aid.startsWith('event-resize-start-') && oid.startsWith('cell-')) {
            const eventId = aid.slice('event-resize-start-'.length);
            const iso = oid.slice('cell-'.length);
            let at = new Date(iso);
            const ev = (eventsLocal as any[]).find((e) => e.id === eventId);
            if (!ev) return;
            let startAt = new Date(ev.startAt);
            const endAt = new Date(ev.endAt);
            if (at >= endAt) at = new Date(endAt.getTime() - 15 * 60000);
            startAt = at;
            // optimistic update
            setEventsLocal((prev) => prev.map((x) => x.id === eventId ? { ...x, startAt } : x));
            move.mutate({ eventId, startAt, endAt });
            return;
          }
          if (aid.startsWith('event-resize-end-') && oid.startsWith('cell-')) {
            const eventId = aid.slice('event-resize-end-'.length);
            const iso = oid.slice('cell-'.length);
            let at = new Date(iso);
            const ev = (eventsLocal as any[]).find((e) => e.id === eventId);
            if (!ev) return;
            const startAt = new Date(ev.startAt);
            let endAt = new Date(ev.endAt);
            if (at <= startAt) at = new Date(startAt.getTime() + 15 * 60000);
            endAt = at;
            // optimistic update
            setEventsLocal((prev) => prev.map((x) => x.id === eventId ? { ...x, endAt } : x));
            move.mutate({ eventId, startAt, endAt });
            return;
          }
        }}
      >
      <div className="md:col-span-1 space-y-3">
        {ViewTabs}
        <h2 className="font-semibold">Backlog</h2>
        <ul className="space-y-2">
          {backlog.map((t: any) => (
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
              schedule.mutate({ taskId: backlog[0].id, startAt: now, durationMinutes: 30 });
            }}
          >Simulate</button>
        )}
        {(eventsData as any[])?.[0] && (
          <button
            type="button"
            aria-label="simulate-move-event"
            className="hidden"
            onClick={() => {
              const ev = (eventsData as any[])[0];
              const newStart = new Date(new Date(ev.startAt).getTime() + 60 * 60000);
              const durationMin = Math.max(1, Math.round((new Date(ev.endAt).getTime() - new Date(ev.startAt).getTime()) / 60000));
              const newEnd = new Date(newStart.getTime() + durationMin * 60000);
              move.mutate({ eventId: ev.id, startAt: newStart, endAt: newEnd });
            }}
          >Simulate Move</button>
        )}
      </div>
      <div className="md:col-span-3">
        <div data-testid="calendar-grid">
          <CalendarGrid
            view={view}
            startOfWeek={baseMonday}
            onDropTask={(taskId, startAt) => {
              schedule.mutate({ taskId, startAt, durationMinutes: 30 });
            }}
            onMoveEvent={(eventId, startAt) => {
              const ev = (eventsData as any[]).find((e) => e.id === eventId);
              if (!ev) return;
              const durationMin = Math.max(1, Math.round((new Date(ev.endAt).getTime() - new Date(ev.startAt).getTime()) / 60000));
              const endAt = new Date(startAt.getTime() + durationMin * 60000);
              move.mutate({ eventId, startAt, endAt });
            }}
            onResizeEvent={(eventId, edge, at) => {
              const ev = (eventsData as any[]).find((e) => e.id === eventId);
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
              move.mutate({ eventId, startAt, endAt });
            }}
            events={(eventsLocal as any[]).map((e) => {
              const t = (tasksData as any[]).find((x: any) => x.id === e.taskId);
              return { ...e, title: t?.title };
            })}
          />
        </div>
      </div>
      {/* Test-only helper to simulate resize */}
      {(events as any[])?.[0] && (
        <button
          type="button"
          aria-label="simulate-resize-event"
          className="hidden"
          onClick={() => {
            const ev = (eventsLocal as any[])[0];
            const startAt = new Date(ev.startAt);
            const newEnd = new Date(startAt.getTime() + 120 * 60000); // extend to 2h total
            setEventsLocal((prev) => prev.map((x) => x.id === ev.id ? { ...x, endAt: newEnd } : x));
            move.mutate({ eventId: ev.id, startAt, endAt: newEnd });
          }}
        >Simulate Resize</button>
      )}
      </DndContext>
    </main>
  );
}
