"use client";
import React from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { calculateDurationMinutes } from '@/lib/datetime';
import { EventBox } from './EventBox';

type ViewMode = 'day' | 'week';

export function TimeGrid(props: {
  view: ViewMode;
  startOfWeek?: Date;
  onDropTask: (taskId: string, startAt: Date) => void;
  onMoveEvent?: (eventId: string, startAt: Date) => void;
  onResizeEvent?: (eventId: string, edge: 'start' | 'end', at: Date) => void;
  events: { id: string; taskId: string; startAt: Date | string; endAt: Date | string; title?: string }[];
  workStartHour?: number;
  workEndHour?: number;
  onClickSlot?: (startAt: Date) => void;
}) {
  const { view } = props;
  const days = getDays(view, props.startOfWeek);
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

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
      <div className="grid" style={{ gridTemplateColumns: `80px repeat(${days.length}, 1fr)` }}>
        <div className="bg-slate-50 dark:bg-slate-900 p-2 text-xs">Time</div>
        {days.map((d) => (
          <div
            key={d.toDateString()}
            className={`p-2 text-xs text-center ${
              isSameDay(d, new Date())
                ? 'bg-blue-50 font-semibold dark:bg-blue-900/30'
                : 'bg-slate-50 dark:bg-slate-900'
            }`}
            aria-current={isSameDay(d, new Date()) ? 'date' : undefined}
            title={isSameDay(d, new Date()) ? 'Today' : undefined}
          >
            {d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })}
          </div>
        ))}
      </div>
      <div className="relative">
        <div className="grid" style={{ gridTemplateColumns: `80px repeat(${days.length}, 1fr)` }}>
          {Array.from({ length: rows }).map((_, row) => {
            const hour = startHour + row;
            return (
              <React.Fragment key={hour}>
                <div className="p-2 text-xs border-t h-12">{formatHour(hour)}</div>
                {days.map((d) => (
                  <GridCell
                    key={d.toDateString() + hour}
                    day={d}
                    hour={hour}
                    onClickSlot={props.onClickSlot}
                  />
                ))}
              </React.Fragment>
            );
          })}
        </div>
        <div className="absolute inset-0 pointer-events-none">
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
            const durMin = calculateDurationMinutes(s, ed);
            const pxPerMin = rowPx / 60;
            const topPx = topMin * pxPerMin;
            const heightPx = Math.max(12, durMin * pxPerMin);
            const left = `calc(80px + ${dayIdx} * ((100% - 80px) / ${days.length}))`;
            const width = `calc((100% - 80px) / ${days.length})`;
            return (
              <EventBox
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

function GridCell({
  day,
  hour,
  onClickSlot,
}: {
  day: Date;
  hour: number;
  onClickSlot?: (startAt: Date) => void;
}) {
  const slot = new Date(day);
  slot.setHours(hour, 0, 0, 0);
  const id = 'cell-' + slot.toISOString();
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`h-12 border-t border-l ${isOver ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
      onClick={() => onClickSlot?.(slot)}
      data-testid={`time-slot-${slot.toISOString()}`}
    ></div>
  );
}

export function DraggableTask({
  id,
  title,
  onSpaceKey,
  labelId,
  description,
  descriptionId,
}: {
  id: string;
  title: string;
  onSpaceKey?: () => void;
  labelId?: string;
  description?: string;
  descriptionId?: string;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: `task-${id}` });
  const style: React.CSSProperties = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {};
  const descId = description ? descriptionId ?? `${id}-desc` : undefined;
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="w-full text-left px-2 py-1 rounded border"
      style={style}
      aria-labelledby={labelId}
      aria-describedby={descId}
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
      <span id={labelId}>{title}</span>
      {description && (
        <span id={descId} className="sr-only">
          {description}
        </span>
      )}
    </button>
  );
}

function getDays(view: ViewMode, base?: Date): Date[] {
  const baseDate = base ? new Date(base) : new Date();
  baseDate.setHours(0, 0, 0, 0);
  if (view === 'day') return [baseDate];
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

function formatHour(h: number) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = ((h + 11) % 12) + 1;
  return `${hr} ${ampm}`;
}

function clampHour(h: number, isEnd = false): number {
  if (!Number.isFinite(h)) return isEnd ? 24 : 0;
  const n = Math.max(0, Math.min(24, Math.floor(h)));
  if (isEnd && n === 0) return 24;
  return n;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
