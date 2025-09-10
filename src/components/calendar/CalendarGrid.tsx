"use client";
import React from 'react';
import { MonthView } from './MonthView';
import { TimeGrid, DraggableTask } from './TimeGrid';

type ViewMode = 'day' | 'week' | 'month';

export function CalendarGrid(props: {
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
  if (props.view === 'month') {
    return <MonthView startOfWeek={props.startOfWeek} events={props.events} />;
  }
  return <TimeGrid {...props} view={props.view} />;
}

export { DraggableTask };
