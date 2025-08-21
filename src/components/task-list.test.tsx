// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { TaskList } from './task-list';
import type { RouterOutputs } from '@/server/api/root';

type Task = RouterOutputs['task']['list'][number];

// Capture items passed to SortableContext so we can assert compaction
const sortableItemsCalls: unknown[][] = [];
let triggerDragEnd: ((event: any) => void) | undefined;

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: any) => {
    triggerDragEnd = onDragEnd;
    return <div>{children}</div>;
  },
  closestCenter: vi.fn(),
}));
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
    {
      id: '1',
      title: 'Test 1',
      dueAt: null,
      status: 'DONE',
      subject: 'math',
      priority: 'HIGH',
    },
    {
      id: '2',
      title: 'Test 2',
      dueAt: null,
      status: 'TODO',
      subject: 'science',
      priority: 'LOW',
    },
  ],
  isLoading: false,
  error: undefined,
};
const useQueryMock = vi.fn().mockReturnValue(defaultQuery);
const setStatusMock = vi.fn();
const reorderMutate = vi.fn();
const bulkUpdateMock = vi.fn();
const bulkDeleteMock = vi.fn();
const virtualizerMock = vi
  .fn()
  .mockReturnValue({ getTotalSize: () => 0, getVirtualItems: () => [] });

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
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      setDueDate: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
          error: { message: 'Failed to set due date' },
        }),
      },
      updateTitle: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      setStatus: { useMutation: () => ({ mutate: setStatusMock, isPending: false, error: undefined }) },
      reorder: { useMutation: () => ({ mutate: reorderMutate, isPending: false, error: undefined }) },
      bulkUpdate: { useMutation: () => ({ mutate: bulkUpdateMock, isPending: false, error: undefined }) },
      bulkDelete: { useMutation: () => ({ mutate: bulkDeleteMock, isPending: false, error: undefined }) },
    },
  },
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: any) => virtualizerMock(opts),
}));

afterEach(() => {
  cleanup();
  useQueryMock.mockReturnValue(defaultQuery);
  sortableItemsCalls.length = 0;
  setStatusMock.mockClear();
  reorderMutate.mockClear();
  bulkUpdateMock.mockClear();
  bulkDeleteMock.mockClear();
  virtualizerMock.mockReset();
  virtualizerMock.mockReturnValue({ getTotalSize: () => 0, getVirtualItems: () => [] });
  triggerDragEnd = undefined;
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

  it('renders subject and priority badges', () => {
    render(<TaskList />);
    expect(screen.getByText('math', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('High', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Low', { selector: 'span' })).toBeInTheDocument();
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
    expect(screen.getByText('Math homework')).toBeInTheDocument();
  });

  it('displays archived count', () => {
    // Return DONE only for archive filter, everything for others
    useQueryMock.mockImplementation((input?: unknown) => {
      const base = {
        data: [
          { id: '1', title: 'Test 1', dueAt: null, status: 'DONE', subject: 'math' },
          { id: '2', title: 'Test 2', dueAt: null, status: 'TODO' },
        ],
        isLoading: false,
        error: undefined,
      };
      if (input && input.filter === 'archive') {
        return { data: base.data.filter((t: Task) => t.status === 'DONE'), isLoading: false, error: undefined };
      }
      return base;
    });
    render(<TaskList />);
    expect(screen.getByText('1 archived')).toBeInTheDocument();
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
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
  });

  it('updates task status via dropdown', () => {
    render(<TaskList />);
    const toggles = screen.getAllByLabelText('Change status');
    // Open dropdown for the second task (id: '2')
    fireEvent.click(toggles[1]);
    // Click "In progress"
    fireEvent.click(screen.getByText('In progress'));
    expect(setStatusMock).toHaveBeenCalledWith({ id: '2', status: 'IN_PROGRESS' });

    // Open again and choose "Cancelled"
    fireEvent.click(toggles[1]);
    fireEvent.click(screen.getByText('Cancelled'));
    expect(setStatusMock).toHaveBeenCalledWith({ id: '2', status: 'CANCELLED' });
  });

  it('filters tasks by subject', () => {
    render(<TaskList />);
    const select = screen.getByLabelText('Subject filter');
    fireEvent.change(select, { target: { value: 'math' } });
    expect(screen.getByText('Test 1')).toBeInTheDocument();
    expect(screen.queryByText('Test 2')).not.toBeInTheDocument();
  });

  it('renders all items normally for small lists', () => {
    const small = Array.from({ length: 10 }, (_, i) => ({ id: `${i}`, title: `Task ${i}`, dueAt: null }));
    useQueryMock.mockReturnValue({ data: small, isLoading: false, error: undefined });
    render(<TaskList />);
    expect(virtualizerMock).not.toHaveBeenCalled();
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
  });

  it('virtualizes large lists to limit DOM nodes', () => {
    const big = Array.from({ length: 250 }, (_, i) => ({ id: `${i}`, title: `Task ${i}`, dueAt: null }));
    useQueryMock.mockReturnValue({ data: big, isLoading: false, error: undefined });
    virtualizerMock.mockReturnValue({
      getTotalSize: () => big.length * 60,
      getVirtualItems: () =>
        Array.from({ length: 20 }, (_, i) => ({ index: i, start: i * 60, size: 60 })),
    });
    render(<TaskList />);
    expect(virtualizerMock).toHaveBeenCalled();
    expect(screen.getAllByRole('listitem')).toHaveLength(20);
  });

  it('reverts order when reorder mutation fails', async () => {
    reorderMutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(new Error('fail'));
    });
    render(<TaskList />);
    const initialOrder = screen
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    triggerDragEnd?.({ active: { id: '1' }, over: { id: '2' } });
    await waitFor(() => {
      const order = screen
        .getAllByRole('listitem')
        .map((li) => li.textContent);
      expect(order).toEqual(initialOrder);
    });
  });

  it('shows bulk actions and performs bulk update', () => {
    render(<TaskList />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(screen.getByTestId('bulk-actions')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Mark done'));
    expect(bulkUpdateMock).toHaveBeenCalledWith({ ids: ['1', '2'], status: 'DONE' });
  });

  it('deletes selected tasks via bulk delete', () => {
    render(<TaskList />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByText('Delete'));
    expect(bulkDeleteMock).toHaveBeenCalledWith({ ids: ['1', '2'] });
  });
});
