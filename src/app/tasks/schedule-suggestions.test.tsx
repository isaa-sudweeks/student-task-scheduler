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
      task: { list: { invalidate: invalidateTasks } },
      event: { listRange: { invalidate: invalidateEvents } },
    }),
    task: {
      list: { useQuery: () => ({ data: [{ id: 't1', title: 'Task 1', dueAt: null }], isLoading: false }) },
      scheduleSuggestions: { useMutation: () => ({ mutateAsync, isPending: false, error: null }) },
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

  it('generates and accepts suggestions', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: /generate suggestions/i }));
    await screen.findByText(/Task 1/);

    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    await waitFor(() => expect(scheduleMutateAsync).toHaveBeenCalled());
    const arg = scheduleMutateAsync.mock.calls[0][0] as any;
    expect(arg.taskId).toBe('t1');
    expect(arg.durationMinutes).toBe(60);
  });
});

