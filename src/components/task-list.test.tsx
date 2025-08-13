// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { TaskList } from './task-list';

// Capture items passed to SortableContext so we can assert compaction
const sortableItemsCalls: unknown[][] = [];
vi.mock('@dnd-kit/sortable', async () => {
  return {
    // Record each items prop received to verify it matches filtered list
    SortableContext: ({ items, children }: { items: unknown; children: React.ReactNode }) => {
      sortableItemsCalls.push(Array.isArray(items) ? [...items] : [items]);
      return <div data-testid="sortable-context">{children}</div> as any;
    },
    useSortable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: () => {},
      transform: null,
      transition: null,
    }),
    arrayMove: (arr: unknown[]) => arr,
  } as any;
});

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
  sortableItemsCalls.length = 0;
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

  it('compacts visible tasks to the top when filtering', async () => {
    useQueryMock.mockReturnValue({
      data: [
        { id: 'a', title: 'Alpha', dueAt: null, status: 'TODO' },
        { id: 'b', title: 'Beta', dueAt: null, status: 'TODO' },
        { id: 'c', title: 'Gamma', dueAt: null, status: 'TODO' },
      ],
      isLoading: false,
      error: undefined,
    });
    render(<TaskList />);

    // Type a query that matches only one item
    const input = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(input, { target: { value: 'gamma' } });

    // The last SortableContext call should receive only the filtered ids
    const lastCall = sortableItemsCalls[sortableItemsCalls.length - 1] as string[];
    expect(lastCall).toEqual(['c']);
    // Only the matching task remains in the DOM (no gaps)
    expect(screen.getByDisplayValue('Gamma')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Alpha')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Beta')).not.toBeInTheDocument();
  });
});
