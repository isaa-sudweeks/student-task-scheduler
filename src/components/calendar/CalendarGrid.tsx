"use client";
import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';

type ViewMode = 'day' | 'week' | 'month';

export function CalendarGrid(props: {
  view: ViewMode;
  startOfWeek?: Date;
  onDropTask: (taskId: string, startAt: Date) => void;
  onMoveEvent?: (eventId: string, startAt: Date) => void;
  onResizeEvent?: (eventId: string, edge: 'start' | 'end', at: Date) => void;
  events: { id: string; taskId: string; startAt: Date | string; endAt: Date | string; title?: string }[];
}) {
  const { view } = props;
  const days = getDays(view, props.startOfWeek);
  const startHour = 8;
  const endHour = 18;
  const rows = endHour - startHour;
  const rowPx = 48;

  return (
      <div className="border rounded overflow-hidden">
        {/* Header */}
        <div className="grid" style={{ gridTemplateColumns: `80px repeat(${days.length}, 1fr)` }}>
          <div className="bg-slate-50 dark:bg-slate-900 p-2 text-xs">Time</div>
          {days.map((d) => (
            <div key={d.toDateString()} className="bg-slate-50 dark:bg-slate-900 p-2 text-xs text-center">
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
  const moveStyle: React.CSSProperties = ev.transform ? { transform: `translate3d(${ev.transform.x}px, ${ev.transform.y}px, 0)` } : {};
  const startStyle: React.CSSProperties = resStart.transform ? { transform: `translate3d(${resStart.transform.x}px, ${resStart.transform.y}px, 0)` } : {};
  const endStyle: React.CSSProperties = resEnd.transform ? { transform: `translate3d(${resEnd.transform.x}px, ${resEnd.transform.y}px, 0)` } : {};

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
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { useDndMonitor } = require('@dnd-kit/core');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useDndMonitor({
    onDragEnd: (event: any) => {
      const activeId = String(event.active?.id ?? '');
      onDragEnd(activeId);
    },
  });
  return (
    <div
      ref={ev.setNodeRef}
      className="pointer-events-auto select-none rounded border bg-slate-100/90 px-2 py-1 text-xs dark:bg-slate-800/90"
      style={{ ...style, ...moveStyle }}
    >
      <div className="flex items-center justify-between cursor-move" {...ev.attributes} {...ev.listeners}>
        <span>{title || 'Event'}</span>
      </div>
      <div
        ref={resStart.setNodeRef}
        {...resStart.attributes}
        {...resStart.listeners}
        className="absolute left-1/2 top-0 z-10 h-3 w-8 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize rounded bg-slate-400 dark:bg-slate-600"
        style={startStyle}
        aria-label="resize start"
      />
      <div
        ref={resEnd.setNodeRef}
        {...resEnd.attributes}
        {...resEnd.listeners}
        className="absolute bottom-0 left-1/2 z-10 h-3 w-8 -translate-x-1/2 translate-y-1/2 cursor-ns-resize rounded bg-slate-400 dark:bg-slate-600"
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
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(baseDate);
    d.setDate(1 + i);
    days.push(d);
  }
  return days;
}

function formatHour(h: number) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = ((h + 11) % 12) + 1;
  return `${hr} ${ampm}`;
}
