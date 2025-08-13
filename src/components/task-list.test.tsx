// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { TaskList } from './task-list';

const defaultQuery = {
  data: [
    { id: '1', title: 'Test 1', dueAt: null, status: 'DONE', subject: 'math' },
    { id: '2', title: 'Test 2', dueAt: null, status: 'TODO' },
  ],
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
      create: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
          error: { message: 'Failed to create task' },
        }),
      },
      setDueDate: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
          error: { message: 'Failed to set due date' },
        }),
      },
      updateTitle: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      setStatus: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      reorder: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
    },
  },
}));

afterEach(() => {
  cleanup();
  useQueryMock.mockReturnValue(defaultQuery);
});

describe('TaskList', () => {
  it('shows loading skeleton when tasks are loading', () => {
    useQueryMock.mockReturnValue({
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

  it('renders subject badge', () => {
    render(<TaskList />);
    expect(screen.getByText('math')).toBeInTheDocument();
  });

  it('filters tasks based on search query', () => {
    render(<TaskList />);
    const input = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(input, { target: { value: 'Nope' } });
    expect(screen.queryByText('Test')).not.toBeInTheDocument();
    expect(screen.getByText('No tasks.')).toBeInTheDocument();
  });

  it('filters by title only and ignores subject', () => {
    useQueryMock.mockReturnValueOnce({
      data: [
        { id: '1', title: 'Read book', dueAt: null, subject: 'Math' },
        { id: '2', title: 'Math homework', dueAt: null, subject: 'English' },
      ],
      isLoading: false,
      error: undefined,
    });
    render(<TaskList />);
    const input = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(input, { target: { value: 'math' } });
    // Should match by title (subject alone should not matter)
    expect(screen.getByDisplayValue('Math homework')).toBeInTheDocument();
  });

  it('displays completed task ratio', () => {
    render(<TaskList />);
    expect(screen.getByText('1/2 completed')).toBeInTheDocument();
  });
});
