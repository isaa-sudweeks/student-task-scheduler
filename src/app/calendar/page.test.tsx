// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import { useSession } from 'next-auth/react';
import CalendarPage from './page';

const focusStart = vi.fn();
const focusStop = vi.fn();
const scheduleMutate = vi.fn();
const moveMutate = vi.fn();
const taskCreate = vi.fn();
const scheduleSuggestionsMutateAsync = vi.fn();

let scheduleSuggestionsPending = false;
let scheduleSuggestionsError: Error | null = null;

const tasks = [
  { id: 't1', title: 'Unscheduled task', status: 'TODO', dueAt: null },
  { id: 't2', title: 'Scheduled task', status: 'TODO', dueAt: null },
];

const events = [
  { id: 'e1', taskId: 't2', startAt: new Date('2099-01-01T10:00:00Z'), endAt: new Date('2099-01-01T11:00:00Z') },
];

let tasksLoading = false;
let eventsLoading = false;

const tasksQueryMock = {
  data: tasks,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
};
const eventsQueryMock = {
  data: events,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
};
type MockUserSettings = {
  timezone: string;
  dayWindowStartHour: number;
  dayWindowEndHour: number;
  defaultDurationMinutes: number;
  googleSyncEnabled: boolean;
  llmProvider?: 'NONE' | 'OPENAI' | 'LM_STUDIO';
  openaiApiKey?: string | null;
  lmStudioUrl?: string | null;
};
const userSettingsQueryMock: {
  data: MockUserSettings | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: ReturnType<typeof vi.fn>;
} = {
  data: undefined,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
};
const setSettingsMock = vi.fn();

vi.mock('@/server/api/react', () => ({
    api: {
      useUtils: () => ({
        task: { list: { invalidate: vi.fn() } },
        event: { listRange: { invalidate: vi.fn() } },
        focus: { status: { invalidate: vi.fn() } },
        user: { getSettings: { invalidate: vi.fn() } },
      }),
      task: {
        list: {
        useQuery: () => ({
          ...tasksQueryMock,
          data: tasksLoading ? undefined : tasksQueryMock.data,
          isLoading: tasksLoading,
        }),
        },
        create: {
          useMutation: (opts?: any) => ({
            mutate: (args: any, o2?: any) => {
              taskCreate(args);
              const onSuccess = o2?.onSuccess ?? opts?.onSuccess;
              onSuccess?.({ id: 'nt1', title: args.title });
            },
          }),
        },
        scheduleSuggestions: {
          useMutation: () => ({
            mutateAsync: (...a: unknown[]) => scheduleSuggestionsMutateAsync(...a),
            isPending: scheduleSuggestionsPending,
            error: scheduleSuggestionsError,
          }),
        },
      },
      event: {
        listRange: {
        useQuery: () => ({
          ...eventsQueryMock,
          data: eventsLoading ? undefined : eventsQueryMock.data,
          isLoading: eventsLoading,
        }),
        },
        schedule: { useMutation: () => ({ mutate: (...a: unknown[]) => scheduleMutate(...a) }) },
        move: { useMutation: () => ({ mutate: (...a: unknown[]) => moveMutate(...a) }) },
      },
      user: {
        getSettings: {
        useQuery: (_input?: unknown, opts?: { enabled?: boolean }) => ({
          ...userSettingsQueryMock,
          data: opts?.enabled === false ? undefined : userSettingsQueryMock.data,
          isLoading: userSettingsQueryMock.isLoading,
        }),
        },
        setSettings: {
          useMutation: (opts?: { onSuccess?: () => void }) => ({
            mutate: (args: unknown) => {
              setSettingsMock(args);
              opts?.onSuccess?.();
            },
          }),
        },
      },
    focus: {
      start: { useMutation: () => ({ mutate: (...a: unknown[]) => focusStart(...a) }) },
      stop: { useMutation: () => ({ mutate: (...a: unknown[]) => focusStop(...a) }) },
    },
  },
}));

const useSessionMock = vi.mocked(useSession);

describe('CalendarPage', () => {
  beforeEach(() => {
    focusStart.mockReset();
    focusStop.mockReset();
    scheduleMutate.mockReset();
    moveMutate.mockReset();
    taskCreate.mockReset();
    scheduleSuggestionsMutateAsync.mockReset();
    tasksLoading = false;
    eventsLoading = false;
    tasksQueryMock.error = null;
    tasksQueryMock.refetch.mockReset();
    eventsQueryMock.error = null;
    eventsQueryMock.refetch.mockReset();
    userSettingsQueryMock.data = undefined;
    userSettingsQueryMock.isLoading = false;
    userSettingsQueryMock.error = null;
    userSettingsQueryMock.refetch.mockReset();
    setSettingsMock.mockReset();
    useSessionMock.mockReset();
    useSessionMock.mockReturnValue({ data: { user: { name: 'Test User', image: null } }, status: 'authenticated' });
    window.localStorage.clear();
    window.localStorage.setItem('dayWindowStartHour', '6');
    window.localStorage.setItem('dayWindowEndHour', '20');
    window.localStorage.setItem('defaultDurationMinutes', '30');
    scheduleSuggestionsPending = false;
    scheduleSuggestionsError = null;
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

  it('does not render its own account menu', () => {
    render(<CalendarPage />);
    expect(screen.queryByLabelText(/account menu/i)).toBeNull();
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

  it('aligns backlog section to the top', () => {
    render(<CalendarPage />);
    const backlogSection = screen.getByRole('heading', { name: /backlog/i }).parentElement;
    expect(backlogSection).toHaveClass('self-start');
  });

  it('shows errors from queries and retries when prompted', () => {
    tasksQueryMock.error = new Error('oops tasks');
    eventsQueryMock.error = new Error('oops events');
    render(<CalendarPage />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Failed to load tasks');
    expect(alert).toHaveTextContent('Failed to load events');
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(tasksQueryMock.refetch).toHaveBeenCalled();
    expect(eventsQueryMock.refetch).toHaveBeenCalled();
  });

  it('focus mode toggles on with Space on a task', () => {
    render(<CalendarPage />);
    const backlogItem = screen.getByRole('button', { name: /^Unscheduled task$/i });

    backlogItem.focus();
    fireEvent.keyDown(backlogItem, { key: 'Space' });
    expect(focusStart).toHaveBeenCalledWith({ taskId: 't1' });
    expect(screen.getByText(/Focusing:/i)).toBeInTheDocument();
  });

  it('announces elapsed focus time updates', () => {
    vi.useFakeTimers();
    render(<CalendarPage />);

    const focusBtn = screen.getByRole('button', { name: /focus Unscheduled task/i });
    fireEvent.click(focusBtn);

    const timer = screen.getByRole('timer', { name: /elapsed focus time/i });
    expect(timer).toHaveAttribute('aria-live', 'polite');
    expect(timer).toHaveTextContent('0s');

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(timer).toHaveTextContent('2s');
    vi.useRealTimers();
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

  it('creates and schedules a new task when clicking a calendar slot', () => {
    render(<CalendarPage />);
    const slot = screen.getByTestId('time-slot-2098-12-29T00:00:00.000Z');
    fireEvent.click(slot);
    fireEvent.change(screen.getByLabelText(/task title/i), { target: { value: 'New Task' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    expect(taskCreate).toHaveBeenCalledWith({ title: 'New Task' });
    const arg = scheduleMutate.mock.calls[0][0] as any;
    expect(arg.taskId).toBe('nt1');
    expect(arg.startAt.toISOString()).toBe('2098-12-29T00:00:00.000Z');
    expect(arg.durationMinutes).toBe(30);
  });

  it('updates settings and applies them immediately', () => {
    render(<CalendarPage />);
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    fireEvent.change(screen.getByLabelText(/day start/i), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText(/day end/i), { target: { value: '19' } });
    fireEvent.change(screen.getByLabelText(/default duration/i), { target: { value: '45' } });
    expect(window.localStorage.getItem('dayWindowStartHour')).toBe('7');
    expect(window.localStorage.getItem('dayWindowEndHour')).toBe('19');
    expect(window.localStorage.getItem('defaultDurationMinutes')).toBe('45');
    expect(screen.getAllByLabelText('work-hours-7-19').length).toBeGreaterThan(0);
    const simulateDrop = screen.getByRole('button', { name: /simulate-drop-unscheduled/i });
    fireEvent.click(simulateDrop);
    const arg = scheduleMutate.mock.calls.pop()![0] as any;
    expect(arg.dayWindowStartHour).toBe(7);
    expect(arg.dayWindowEndHour).toBe(19);
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

  it('renders a loading spinner while data loads', () => {
    tasksLoading = true;
    eventsLoading = true;
    render(<CalendarPage />);
    expect(screen.getByLabelText(/loading calendar/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /backlog/i })).toBeNull();
    expect(screen.queryByTestId('calendar-grid')).toBeNull();
  });

  it('generates and accepts AI suggestions for the selected backlog tasks', async () => {
    const suggestion = {
      taskId: 't1',
      startAt: new Date('2099-01-02T09:00:00Z'),
      endAt: new Date('2099-01-02T09:30:00Z'),
      origin: 'fallback' as const,
    };
    scheduleSuggestionsMutateAsync.mockResolvedValueOnce({ suggestions: [suggestion] });
    render(<CalendarPage />);

    const generate = screen.getByRole('button', { name: /generate/i });
    expect(generate).toBeEnabled();
    fireEvent.click(generate);
    await waitFor(() =>
      expect(scheduleSuggestionsMutateAsync).toHaveBeenCalledWith({ taskIds: ['t1'] }),
    );
    await screen.findByText(/fallback/i);
    fireEvent.click(screen.getAllByRole('button', { name: /accept/i })[0]);

    expect(scheduleMutate).toHaveBeenCalled();
    const arg = scheduleMutate.mock.calls.at(-1)![0] as any;
    expect(arg.taskId).toBe('t1');
    expect(arg.startAt).toBeInstanceOf(Date);
    expect(arg.durationMinutes).toBe(30);
  });

  it('disables AI suggestion generation without a backlog selection', () => {
    render(<CalendarPage />);

    const checkbox = screen.getByRole('checkbox', { name: /select unscheduled task/i });
    fireEvent.click(checkbox);

    expect(
      screen.getByText(/select at least one backlog task to enable ai suggestions/i),
    ).toBeInTheDocument();

    const generate = screen.getByRole('button', { name: /generate/i });
    expect(generate).toBeDisabled();
    fireEvent.click(generate);
    expect(scheduleSuggestionsMutateAsync).not.toHaveBeenCalled();
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

  it('prefers server-sourced scheduling preferences and syncs updates back to the API', async () => {
    userSettingsQueryMock.data = {
      timezone: 'America/New_York',
      dayWindowStartHour: 9,
      dayWindowEndHour: 21,
      defaultDurationMinutes: 45,
      googleSyncEnabled: true,
      llmProvider: 'NONE',
      openaiApiKey: null,
      lmStudioUrl: 'http://localhost:5678',
    };

    render(<CalendarPage />);

    await waitFor(() => {
      expect(window.localStorage.getItem('dayWindowStartHour')).toBe('9');
      expect(window.localStorage.getItem('dayWindowEndHour')).toBe('21');
      expect(window.localStorage.getItem('defaultDurationMinutes')).toBe('45');
    });

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    const modal = screen.getByRole('dialog', { name: /calendar settings/i });
    const inputs = within(modal).getAllByRole('spinbutton');
    expect(inputs[0]).toHaveValue(9);
    expect(inputs[1]).toHaveValue(21);
    expect(inputs[2]).toHaveValue(45);
    expect(setSettingsMock).not.toHaveBeenCalled();

    fireEvent.change(inputs[0], { target: { value: '10' } });

    await waitFor(() => {
      expect(setSettingsMock).toHaveBeenCalledTimes(1);
    });
    expect(setSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        timezone: 'America/New_York',
        dayWindowStartHour: 10,
        dayWindowEndHour: 21,
        defaultDurationMinutes: 45,
        googleSyncEnabled: true,
        llmProvider: 'NONE',
        openaiApiKey: null,
        lmStudioUrl: 'http://localhost:5678',
      })
    );
    await waitFor(() => {
      expect(window.localStorage.getItem('dayWindowStartHour')).toBe('10');
    });
  });

  it('falls back to stored preferences when the user is unauthenticated', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' });
    window.localStorage.setItem('dayWindowStartHour', '7');
    window.localStorage.setItem('dayWindowEndHour', '19');
    window.localStorage.setItem('defaultDurationMinutes', '50');

    render(<CalendarPage />);

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    const modal = screen.getByRole('dialog', { name: /calendar settings/i });
    const inputs = within(modal).getAllByRole('spinbutton');
    expect(inputs[0]).toHaveValue(7);
    expect(inputs[1]).toHaveValue(19);
    expect(inputs[2]).toHaveValue(50);
    expect(setSettingsMock).not.toHaveBeenCalled();
  });
});
