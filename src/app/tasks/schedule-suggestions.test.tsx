// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import ScheduleSuggestionsPage from './schedule-suggestions';

const mutateAsync = vi.fn();
const scheduleMutateAsync = vi.fn();
const invalidateTasks = vi.fn();
const invalidateEvents = vi.fn();

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({
      task: {
        list: { invalidate: invalidateTasks },
        listReminders: { invalidate: vi.fn() },
      },
      event: { listRange: { invalidate: invalidateEvents } },
    }),
    task: {
      subjectOptions: { useQuery: () => ({ data: [], isLoading: false }) },
      list: { useQuery: () => ({ data: [{ id: 't1', title: 'Task 1', dueAt: null }], isLoading: false }) },
      scheduleSuggestions: { useMutation: () => ({ mutateAsync, isPending: false, error: null }) },
      listReminders: { useQuery: () => ({ data: [], isLoading: false }) },
      replaceReminders: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false, error: undefined }) },
    },
    event: {
      schedule: { useMutation: () => ({ mutateAsync: scheduleMutateAsync, isPending: false }) },
    },
    user: {
      getSettings: { useQuery: () => ({ data: { dayWindowStartHour: 8, dayWindowEndHour: 18 }, isLoading: false }) },
    },
  },
}));

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  default: { success: vi.fn(), error: vi.fn() },
}));

describe('ScheduleSuggestionsPage', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    scheduleMutateAsync.mockReset();
    invalidateTasks.mockReset();
    invalidateEvents.mockReset();
  });

  it('generates and accepts suggestions for the selected tasks', async () => {
    mutateAsync.mockResolvedValueOnce({
      suggestions: [
        {
          taskId: 't1',
          startAt: new Date('2099-01-01T09:00:00Z'),
          endAt: new Date('2099-01-01T10:00:00Z'),
          origin: 'fallback',
        },
      ],
    });
    scheduleMutateAsync.mockResolvedValueOnce({});

    render(<ScheduleSuggestionsPage />);

    const generate = screen.getByRole('button', { name: /generate suggestions/i });
    expect(generate).toBeEnabled();

    fireEvent.click(generate);
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ taskIds: ['t1'] }),
    );
    await screen.findByText(/Task 1/);

    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    await waitFor(() => expect(scheduleMutateAsync).toHaveBeenCalled());
    const arg = scheduleMutateAsync.mock.calls[0][0] as any;
    expect(arg.taskId).toBe('t1');
    expect(arg.durationMinutes).toBe(60);
  });

  it('disables generation when no tasks are selected', () => {
    render(<ScheduleSuggestionsPage />);

    const checkbox = screen.getByRole('checkbox', { name: /select task 1/i });
    fireEvent.click(checkbox);

    expect(screen.getByText(/select at least one task/i)).toBeInTheDocument();
    const generate = screen.getByRole('button', { name: /generate suggestions/i });
    expect(generate).toBeDisabled();
    fireEvent.click(generate);
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});

