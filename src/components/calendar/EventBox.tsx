"use client";
import React from 'react';
import { useDraggable, useDndMonitor } from '@dnd-kit/core';

export function EventBox({
  id,
  title,
  style,
  pxPerMin,
  onResizeDelta,
}: {
  id: string;
  title: string;
  style: React.CSSProperties;
  pxPerMin: number;
  onResizeDelta?: (edge: 'start' | 'end', deltaMinutes: number) => void;
}) {
  const ev = useDraggable({ id: `event-${id}` });
  const resStart = useDraggable({ id: `event-resize-start-${id}` });
  const resEnd = useDraggable({ id: `event-resize-end-${id}` });
  const lastStartY = React.useRef(0);
  const lastEndY = React.useRef(0);
  const moveStyle: React.CSSProperties = ev.transform
    ? { transform: `translate3d(${ev.transform.x}px, ${ev.transform.y}px, 0)` }
    : {};

  const startY = resStart.transform?.y ?? 0;
  const endY = resEnd.transform?.y ?? 0;

  const baseTop = Number(style.top) || 0;
  const baseHeight = Number(style.height) || 0;
  const dynamicStyle: React.CSSProperties = {
    ...style,
    top: baseTop + startY,
    height: Math.max(12, baseHeight + endY - startY),
  };

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

  const snap = 15;
  const onDragEnd = React.useCallback(
    (activeId: string) => {
      if (activeId === `event-resize-start-${id}`) {
        const deltaMin = Math.round((lastStartY.current / pxPerMin) / snap) * snap;
        if (deltaMin !== 0) onResizeDelta?.('start', deltaMin);
        lastStartY.current = 0;
      } else if (activeId === `event-resize-end-${id}`) {
        const deltaMin = Math.round((lastEndY.current / pxPerMin) / snap) * snap;
        if (deltaMin !== 0) onResizeDelta?.('end', deltaMin);
        lastEndY.current = 0;
      }
    },
    [id, onResizeDelta, pxPerMin]
  );

  useDndMonitor({
    onDragEnd: (event: any) => {
      const activeId = String(event.active?.id ?? '');
      onDragEnd(activeId);
    },
  });

  return (
    <div
      ref={ev.setNodeRef}
      className={`pointer-events-auto select-none rounded border bg-slate-100/90 px-2 py-1 text-xs dark:bg-slate-800/90 transition-[top,height] duration-150 ease-out ${
        isResizing ? 'shadow-lg ring-1 ring-blue-400 dark:ring-blue-600' : ''
      }`}
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
