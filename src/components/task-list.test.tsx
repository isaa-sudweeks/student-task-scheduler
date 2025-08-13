// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { TaskList } from './task-list';

const defaultQuery = {
  data: [{ id: '1', title: 'Test', dueAt: null }],
  isLoading: false,
  error: undefined,
};
const useQueryMock = vi.fn().mockReturnValue(defaultQuery);

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ task: { list: { invalidate: vi.fn() } } }),
    task: {
      list: {
        useQuery: (...args: unknown[]) => useQueryMock(...args),
      },
      updateTitle: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      setStatus: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      setDueDate: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
          error: { message: 'Failed to set due date' },
        }),
      },
    },
  },
}));

afterEach(() => {
  cleanup();
  useQueryMock.mockReturnValue(defaultQuery);
});

describe('TaskList', () => {
  it('shows loading skeleton when tasks are loading', () => {
    useQueryMock.mockReturnValueOnce({
      data: [],
      isLoading: true,
      error: undefined,
    });
    render(<TaskList />);
    expect(screen.getByLabelText('Loading tasks')).toBeInTheDocument();
  });

  it('shows error message when setting due date fails', () => {
    render(<TaskList />);
    expect(screen.getByText('Failed to set due date')).toBeInTheDocument();
  });
});
