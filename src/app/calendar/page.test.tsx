// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import CalendarPage from './page';

const focusStart = vi.fn();
const focusStop = vi.fn();
const scheduleMutate = vi.fn();
const moveMutate = vi.fn();

const tasks = [
  { id: 't1', title: 'Unscheduled task', status: 'TODO', dueAt: null },
  { id: 't2', title: 'Scheduled task', status: 'TODO', dueAt: null },
];

const events = [
  { id: 'e1', taskId: 't2', startAt: new Date('2099-01-01T10:00:00Z'), endAt: new Date('2099-01-01T11:00:00Z') },
];

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({
      task: { list: { invalidate: vi.fn() } },
      event: { listRange: { invalidate: vi.fn() } },
      focus: { status: { invalidate: vi.fn() } },
    }),
    task: {
      list: { useQuery: () => ({ data: tasks, isLoading: false }) },
    },
    event: {
      listRange: { useQuery: () => ({ data: events, isLoading: false }) },
      schedule: { useMutation: () => ({ mutate: (...a: unknown[]) => scheduleMutate(...a) }) },
      move: { useMutation: () => ({ mutate: (...a: unknown[]) => moveMutate(...a) }) },
    },
    focus: {
      start: { useMutation: () => ({ mutate: (...a: unknown[]) => focusStart(...a) }) },
      stop: { useMutation: () => ({ mutate: (...a: unknown[]) => focusStop(...a) }) },
    },
  },
}));

describe('CalendarPage', () => {
  beforeEach(() => {
    focusStart.mockReset();
    focusStop.mockReset();
    scheduleMutate.mockReset();
    moveMutate.mockReset();
    window.localStorage.clear();
    window.localStorage.setItem('dayWindowStartHour', '6');
    window.localStorage.setItem('dayWindowEndHour', '20');
  });

  it('defaults to Week view and can switch views', () => {
    render(<CalendarPage />);

    // Default selected is Week
    const tabs = screen.getByRole('tablist', { name: /calendar view/i });
    expect(within(tabs).getByRole('tab', { selected: true, name: /week/i })).toBeInTheDocument();

    // Switch to Day
    fireEvent.click(within(tabs).getByRole('tab', { name: /day/i }));
    expect(within(tabs).getByRole('tab', { selected: true, name: /day/i })).toBeInTheDocument();

    // Switch to Month
    fireEvent.click(within(tabs).getByRole('tab', { name: /month/i }));
    expect(within(tabs).getByRole('tab', { selected: true, name: /month/i })).toBeInTheDocument();
  });

  it('shows a link back to Home', () => {
    render(<CalendarPage />);
    const link = screen.getByRole('link', { name: /home/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
  });

  it('shows unscheduled tasks in backlog and scheduled tasks on grid', () => {
    render(<CalendarPage />);

    // Backlog shows the unscheduled item
    expect(screen.getByText('Unscheduled task')).toBeInTheDocument();
    // Scheduled task appears in the grid area
    expect(screen.getByTestId('calendar-grid')).toHaveTextContent('Scheduled task');
  });

  it('applies responsive grid layout classes', () => {
    render(<CalendarPage />);
    const main = screen.getByRole('main');
    expect(main).toHaveClass('grid-cols-1');
    expect(main).toHaveClass('md:grid-cols-4');
  });

  it('focus mode toggles on with Space on a task', () => {
    render(<CalendarPage />);
    const backlogItem = screen.getByRole('button', { name: /focus Unscheduled task/i });

    backlogItem.focus();
    fireEvent.keyDown(backlogItem, { key: ' ' });
    expect(focusStart).toHaveBeenCalledWith({ taskId: 't1' });
    expect(screen.getByText(/Focusing:/i)).toBeInTheDocument();
  });

  it('schedules an unscheduled task with default 30 minutes when dropped onto calendar', () => {
    render(<CalendarPage />);
    // Simulate a drop handler call via exposed test hook button
    const simulateDrop = screen.getByRole('button', { name: /simulate-drop-unscheduled/i });
    fireEvent.click(simulateDrop);
    expect(scheduleMutate).toHaveBeenCalled();
    const arg = scheduleMutate.mock.calls[0][0] as any;
    expect(arg.taskId).toBe('t1');
    expect(arg.durationMinutes).toBe(30);
    expect(arg.dayWindowStartHour).toBe(6);
    expect(arg.dayWindowEndHour).toBe(20);
  });

  it('uses stored default duration when scheduling a task', () => {
    window.localStorage.setItem('defaultDurationMinutes', '45');
    render(<CalendarPage />);
    const simulateDrop = screen.getByRole('button', { name: /simulate-drop-unscheduled/i });
    fireEvent.click(simulateDrop);
    const arg = scheduleMutate.mock.calls[0][0] as any;
    expect(arg.durationMinutes).toBe(45);
  });

  it('reschedules an existing event when moved to a new slot', () => {
    render(<CalendarPage />);
    const simulateMove = screen.getByRole('button', { name: /simulate-move-event/i });
    fireEvent.click(simulateMove);
    expect(moveMutate).toHaveBeenCalled();
    const arg = moveMutate.mock.calls[0][0] as any;
    expect(arg.eventId).toBe('e1');
    expect(arg.startAt).toBeInstanceOf(Date);
    expect(arg.endAt).toBeInstanceOf(Date);
    expect(arg.endAt.getTime()).toBeGreaterThan(arg.startAt.getTime());
    expect(arg.dayWindowStartHour).toBe(6);
    expect(arg.dayWindowEndHour).toBe(20);
  });

  it('resizes an existing event when resize handle is dropped to a later slot', () => {
    render(<CalendarPage />);
    const simulateResize = screen.getByRole('button', { name: /simulate-resize-event/i });
    fireEvent.click(simulateResize);
    expect(moveMutate).toHaveBeenCalled();
    const arg = moveMutate.mock.calls.at(-1)![0] as any;
    // Start should remain the same; end should extend
    expect(arg.eventId).toBe('e1');
    expect(arg.startAt).toBeInstanceOf(Date);
    expect(arg.endAt).toBeInstanceOf(Date);
    expect(arg.endAt.getTime()).toBeGreaterThan(arg.startAt.getTime());
    expect(arg.dayWindowStartHour).toBe(6);
    expect(arg.dayWindowEndHour).toBe(20);
  });
  it('navigates between weeks and resets to today', () => {
    vi.useFakeTimers();
    const today = new Date('2024-05-15T12:00:00Z');
    vi.setSystemTime(today);
    render(<CalendarPage />);
    const eventMonday = (() => {
      const d = new Date(events[0].startAt);
      d.setHours(0, 0, 0, 0);
      const diff = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - diff);
      return d;
    })();
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
    expect(screen.getByText(fmt(eventMonday))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    const nextMonday = new Date(eventMonday);
    nextMonday.setDate(eventMonday.getDate() + 7);
    expect(screen.getByText(fmt(nextMonday))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    expect(screen.getByText(fmt(eventMonday))).toBeInTheDocument();
    const todayMonday = (() => {
      const d = new Date(today);
      d.setHours(0, 0, 0, 0);
      const diff = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - diff);
      return d;
    })();
    fireEvent.click(screen.getByRole('button', { name: /today/i }));
    expect(screen.getByText(fmt(todayMonday))).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('navigates between days in Day view', () => {
    render(<CalendarPage />);
    const tabs = screen.getByRole('tablist', { name: /calendar view/i });
    fireEvent.click(within(tabs).getByRole('tab', { name: /day/i }));
    const baseDay = new Date(events[0].startAt);
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
    expect(screen.getByText(fmt(baseDay))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    const nextDay = new Date(baseDay);
    nextDay.setDate(baseDay.getDate() + 1);
    expect(screen.getByText(fmt(nextDay))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    expect(screen.getByText(fmt(baseDay))).toBeInTheDocument();
  });

  it('navigates between months in Month view', () => {
    render(<CalendarPage />);
    const tabs = screen.getByRole('tablist', { name: /calendar view/i });
    fireEvent.click(within(tabs).getByRole('tab', { name: /month/i }));
    expect(screen.getByLabelText('month-day-2099-01-01')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByLabelText('month-day-2099-02-01')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    expect(screen.getByLabelText('month-day-2099-01-01')).toBeInTheDocument();
  });
});
