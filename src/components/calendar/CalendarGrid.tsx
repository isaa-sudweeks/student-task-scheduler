"use client";
import React from 'react';
import { useDraggable, useDroppable, useDndMonitor } from '@dnd-kit/core';

type ViewMode = 'day' | 'week' | 'month';

export function CalendarGrid(props: {
  view: ViewMode;
  startOfWeek?: Date;
  onDropTask: (taskId: string, startAt: Date) => void;
  onMoveEvent?: (eventId: string, startAt: Date) => void;
  onResizeEvent?: (eventId: string, edge: 'start' | 'end', at: Date) => void;
  events: { id: string; taskId: string; startAt: Date | string; endAt: Date | string; title?: string }[];
  workStartHour?: number; // inclusive [0..23]
  workEndHour?: number;   // exclusive [1..24]
}) {
  const { view } = props;
  const days = getDays(view, props.startOfWeek);
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  // Special handling for month view - show a simple month grid with events
  if (view === 'month') {
    const first = days[0];
    const startIdx = (first.getDay() + 6) % 7;
    const blanks = Array.from({ length: startIdx }, () => null as null);
    const cells: (Date | null)[] = [...blanks, ...days];
    const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const ymd = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };
    const eventsByDay = new Map<string, { id: string; title?: string }[]>();
    for (const ev of props.events) {
      const s = new Date(ev.startAt as any);
      const e = new Date(ev.endAt as any);
      const cur = new Date(s);
      cur.setHours(0, 0, 0, 0);
      const end = new Date(e);
      end.setHours(0, 0, 0, 0);
      while (cur <= end) {
        const key = ymd(cur);
        const list = eventsByDay.get(key) ?? [];
        list.push({ id: ev.id, title: ev.title });
        eventsByDay.set(key, list);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return (
      <div className="border rounded overflow-hidden">
        <div className="grid grid-cols-7">
          {weekday.map((w) => (
            <div key={w} className="bg-slate-50 dark:bg-slate-900 p-2 text-xs text-center">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) =>
            d ? (
              <div
                key={d.toDateString()}
                data-testid="day-cell"
                className="h-24 border p-1 text-xs relative"
                aria-label={`month-day-${ymd(d)}`}
              >
                <div
                  className={`font-medium mb-1 px-1 inline-flex items-center justify-center rounded ${
                    isSameDay(d, new Date())
                      ? 'bg-blue-600 text-white dark:bg-blue-500' // highlight today
                      : ''
                  }`}
                  aria-current={isSameDay(d, new Date()) ? 'date' : undefined}
                  title={isSameDay(d, new Date()) ? 'Today' : undefined}
                >
                  {d.getDate()}
                </div>
                <div className="space-y-0.5">
                  {(eventsByDay.get(ymd(d)) ?? []).map((ev) => (
                    <div
                      key={ev.id}
                      data-testid="month-event"
                      className="truncate rounded bg-blue-100 px-1 py-0.5 text-[10px] leading-3 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100"
                      title={ev.title || 'Event'}
                    >
                      {ev.title || 'Event'}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div key={`blank-${i}`} className="h-24 border p-2 text-xs" />
            )
          )}
        </div>
      </div>
    );
  }
  // Show full day, but highlight work window
  const workStart = clampHour(props.workStartHour ?? 8);
  const workEnd = clampHour(props.workEndHour ?? 18, true);
  const startHour = 0;
  const endHour = 24;
  const rows = endHour - startHour;
  const rowPx = 48;
  const showNow =
    (view === 'day' || view === 'week') &&
    days.some((d) => d.toDateString() === now.toDateString());
  const minutesFromStart = now.getHours() * 60 + now.getMinutes() - startHour * 60;
  const top = (minutesFromStart / 60) * rowPx;

  return (
      <div className="border rounded overflow-hidden">
        {/* Header */}
        <div className="grid" style={{ gridTemplateColumns: `80px repeat(${days.length}, 1fr)` }}>
          <div className="bg-slate-50 dark:bg-slate-900 p-2 text-xs">Time</div>
          {days.map((d) => (
            <div
              key={d.toDateString()}
              className={`p-2 text-xs text-center ${
                isSameDay(d, new Date())
                  ? 'bg-blue-50 font-semibold dark:bg-blue-900/30' // highlight today in week/day header
                  : 'bg-slate-50 dark:bg-slate-900'
              }`}
              aria-current={isSameDay(d, new Date()) ? 'date' : undefined}
              title={isSameDay(d, new Date()) ? 'Today' : undefined}
            >
              {d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })}
            </div>
          ))}
        </div>
        {/* Body: droppable grid + overlay */}
        <div className="relative">
          <div className="grid" style={{ gridTemplateColumns: `80px repeat(${days.length}, 1fr)` }}>
            {Array.from({ length: rows }).map((_, row) => {
              const hour = startHour + row;
              return (
                <React.Fragment key={hour}>
                  <div className="p-2 text-xs border-t h-12">{formatHour(hour)}</div>
                  {days.map((d) => (
                    <GridCell key={d.toDateString() + hour} day={d} hour={hour} />
                  ))}
                </React.Fragment>
              );
            })}
          </div>
          <div className="absolute inset-0 pointer-events-none">
            {/* Work hours highlight per day */}
            {days.map((d, idx) => {
              const topPx = workStart * rowPx;
              const heightPx = Math.max(0, (workEnd - workStart) * rowPx);
              const left = `calc(80px + ${idx} * ((100% - 80px) / ${days.length}))`;
              const width = `calc((100% - 80px) / ${days.length})`;
              return (
                <div
                  key={`work-${d.toDateString()}`}
                  data-testid="work-hours-highlight"
                  className="absolute rounded-sm bg-amber-100/40 dark:bg-amber-900/20 border border-amber-300/60 dark:border-amber-700/40"
                  style={{ top: topPx, left, width, height: heightPx }}
                  aria-label={`work-hours-${workStart}-${workEnd}`}
                />
              );
            })}
            {props.events.map((e) => {
              const s = new Date(e.startAt as any);
              const ed = new Date(e.endAt as any);
              const dayIdx = days.findIndex((d) => d.toDateString() === s.toDateString());
              if (dayIdx === -1) return null;
              const startMin = s.getHours() * 60 + s.getMinutes();
              const windowStartMin = startHour * 60;
              const topMin = Math.max(0, startMin - windowStartMin);
              const durMin = Math.max(1, Math.round((ed.getTime() - s.getTime()) / 60000));
              const pxPerMin = rowPx / 60;
              const topPx = topMin * pxPerMin;
              const heightPx = Math.max(12, durMin * pxPerMin);
              const left = `calc(80px + ${dayIdx} * ((100% - 80px) / ${days.length}))`;
              const width = `calc((100% - 80px) / ${days.length})`;
              return (
                <ResizableEventBox
                  key={e.id}
                  id={e.id}
                  title={e.title ?? ''}
                  style={{ position: 'absolute', top: topPx, left, width, height: heightPx }}
                  pxPerMin={pxPerMin}
                  onResizeDelta={(edge, deltaMin) => {
                    const ev = props.events.find((x) => x.id === e.id);
                    if (!ev) return;
                    const startAt = new Date(ev.startAt as any);
                    const endAt = new Date(ev.endAt as any);
                    if (edge === 'start') {
                      const at = new Date(startAt.getTime() + deltaMin * 60_000);
                      // prevent crossing end
                      if (at < endAt) props.onResizeEvent?.(e.id, 'start', at);
                    } else {
                      const at = new Date(endAt.getTime() + deltaMin * 60_000);
                      if (at > startAt) props.onResizeEvent?.(e.id, 'end', at);
                    }
                  }}
                />
              );
            })}
            {showNow && minutesFromStart >= 0 && minutesFromStart <= rows * 60 && (
              <div
                data-testid="now-indicator"
                className="absolute left-20 right-0 h-0.5 bg-red-500"
                style={{ top }}
              />
            )}
          </div>
        </div>
      </div>
  );
}

function GridCell({ day, hour }: { day: Date; hour: number }) {
  const slot = new Date(day);
  slot.setHours(hour, 0, 0, 0);
  const id = 'cell-' + slot.toISOString();
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`h-12 border-t border-l ${isOver ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}></div>
  );
}

export function DraggableTask({ id, title, onSpaceKey }: { id: string; title: string; onSpaceKey?: () => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: `task-${id}` });
  const style: React.CSSProperties = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {};
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="w-full text-left px-2 py-1 rounded border"
      style={style}
      aria-label={`focus ${title}`}
      data-task-id={id}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Space') {
          e.preventDefault();
          onSpaceKey?.();
        }
      }}
      onKeyDownCapture={(e) => {
        if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Space') {
          e.preventDefault();
          onSpaceKey?.();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Space') {
          e.preventDefault();
          onSpaceKey?.();
        }
      }}
      onKeyPress={(e) => {
        if ((e as any).key === ' ' || (e as any).key === 'Spacebar' || (e as any).key === 'Space') {
          e.preventDefault();
          onSpaceKey?.();
        }
      }}
      onClick={() => {
        onSpaceKey?.();
      }}
    >
      {title}
    </button>
  );
}

function ResizableEventBox({ id, title, style, pxPerMin, onResizeDelta }: { id: string; title: string; style: React.CSSProperties; pxPerMin: number; onResizeDelta?: (edge: 'start' | 'end', deltaMinutes: number) => void }) {
  const ev = useDraggable({ id: `event-${id}` });
  const resStart = useDraggable({ id: `event-resize-start-${id}` });
  const resEnd = useDraggable({ id: `event-resize-end-${id}` });
  const lastStartY = React.useRef(0);
  const lastEndY = React.useRef(0);
  const moveStyle: React.CSSProperties = ev.transform
    ? { transform: `translate3d(${ev.transform.x}px, ${ev.transform.y}px, 0)` }
    : {};

  // Track current pixel deltas for live preview
  const startY = resStart.transform?.y ?? 0;
  const endY = resEnd.transform?.y ?? 0;

  const baseTop = Number(style.top) || 0;
  const baseHeight = Number(style.height) || 0;
  const dynamicStyle: React.CSSProperties = {
    ...style,
    top: baseTop + startY,
    height: Math.max(12, baseHeight + endY - startY),
  };

  // Keep handles visually attached to edges as box resizes
  const startStyle: React.CSSProperties = resStart.transform
    ? { transform: `translate3d(${resStart.transform.x}px, ${resStart.transform.y - startY}px, 0)` }
    : {};
  const endStyle: React.CSSProperties = resEnd.transform
    ? { transform: `translate3d(${resEnd.transform.x}px, ${resEnd.transform.y - endY}px, 0)` }
    : {};

  const isResizing = resStart.isDragging || resEnd.isDragging || ev.isDragging;

  React.useEffect(() => {
    if (resStart.transform) lastStartY.current = resStart.transform.y;
  }, [resStart.transform]);
  React.useEffect(() => {
    if (resEnd.transform) lastEndY.current = resEnd.transform.y;
  }, [resEnd.transform]);

  // Listen for drag end to convert pixel delta -> minutes delta
  const snap = 15; // minutes
  const onDragEnd = React.useCallback((activeId: string) => {
    if (activeId === `event-resize-start-${id}`) {
      const deltaMin = Math.round((lastStartY.current / pxPerMin) / snap) * snap;
      if (deltaMin !== 0) onResizeDelta?.('start', deltaMin);
      lastStartY.current = 0;
    } else if (activeId === `event-resize-end-${id}`) {
      const deltaMin = Math.round((lastEndY.current / pxPerMin) / snap) * snap;
      if (deltaMin !== 0) onResizeDelta?.('end', deltaMin);
      lastEndY.current = 0;
    }
  }, [id, onResizeDelta, pxPerMin]);

  // Using window-level dnd monitor to detect when the specific handle ends dragging
  useDndMonitor({
    onDragEnd: (event: any) => {
      const activeId = String(event.active?.id ?? '');
      onDragEnd(activeId);
    },
  });
  return (
    <div
      ref={ev.setNodeRef}
      className={`pointer-events-auto select-none rounded border bg-slate-100/90 px-2 py-1 text-xs dark:bg-slate-800/90 transition-[top,height] duration-150 ease-out ${isResizing ? 'shadow-lg ring-1 ring-blue-400 dark:ring-blue-600' : ''}`}
      style={{ ...dynamicStyle, ...moveStyle }}
    >
      <div className="flex items-center justify-between cursor-move" {...ev.attributes} {...ev.listeners}>
        <span>{title || 'Event'}</span>
      </div>
      <div
        ref={resStart.setNodeRef}
        {...resStart.attributes}
        {...resStart.listeners}
        className="absolute left-1/2 top-0 z-10 h-3 w-8 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize rounded bg-slate-400 dark:bg-slate-600 transition-transform duration-150"
        style={startStyle}
        aria-label="resize start"
      />
      <div
        ref={resEnd.setNodeRef}
        {...resEnd.attributes}
        {...resEnd.listeners}
        className="absolute bottom-0 left-1/2 z-10 h-3 w-8 -translate-x-1/2 translate-y-1/2 cursor-ns-resize rounded bg-slate-400 dark:bg-slate-600 transition-transform duration-150"
        style={endStyle}
        aria-label="resize end"
      />
    </div>
  );
}

function getDays(view: ViewMode, base?: Date): Date[] {
  const baseDate = base ? new Date(base) : new Date();
  baseDate.setHours(0, 0, 0, 0);
  if (view === 'day') return [baseDate];
  if (view === 'week') {
    const days: Date[] = [];
    const day = baseDate.getDay();
    const monday = new Date(baseDate);
    const diff = (day + 6) % 7;
    monday.setDate(baseDate.getDate() - diff);
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }
  // Use UTC year/month to avoid off-by-one when system time is set to UTC midnight
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const days: Date[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    // Construct dates in local time for rendering but based on UTC Y-M
    days.push(new Date(year, month, i));
  }
  return days;
}

function formatHour(h: number) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = ((h + 11) % 12) + 1;
  return `${hr} ${ampm}`;
}

function clampHour(h: number, isEnd = false): number {
  if (!Number.isFinite(h)) return isEnd ? 24 : 0;
  const n = Math.max(0, Math.min(24, Math.floor(h)));
  if (isEnd && n === 0) return 24; // allow 24 as exclusive end
  return n;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
