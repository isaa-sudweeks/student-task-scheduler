// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { TaskList } from './task-list';
import type { RouterOutputs } from '@/server/api/root';

type Task = RouterOutputs['task']['list'][number];

const defaultTasks: Task[] = [
  { id: '1', title: 'Test 1', dueAt: null, status: 'DONE', subject: 'math' } as any,
  { id: '2', title: 'Test 2', dueAt: null, status: 'TODO', subject: 'science' } as any,
];

// DnD mocks to support reorder tests
let triggerDragEnd: any;
const sortableItemsCalls: unknown[][] = [];

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
      sortableItemsCalls.push(Array.isArray(items) ? [...(items as unknown[])] : [items]);
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

const fetchNextPageMock = vi.fn();
const useInfiniteQueryMock = vi.fn();

const defaultQuery = {
  data: [
    { id: '1', title: 'Test 1', dueAt: null, status: 'DONE', subject: 'math', priority: 'HIGH' },
    { id: '2', title: 'Test 2', dueAt: null, status: 'TODO', subject: 'science', priority: 'LOW' },
  ],
  isLoading: false,
  error: undefined,
};
const useQueryMock = vi.fn().mockReturnValue(defaultQuery);

const bulkUpdateMock = vi.fn();
const bulkDeleteMock = vi.fn();
const setStatusMock = vi.fn();
const reorderMutate = vi.fn();

const virtualizerMock = vi
  .fn()
  .mockReturnValue({ getTotalSize: () => 0, getVirtualItems: () => [] });

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ task: { list: { invalidate: vi.fn() } } }),
    task: {
      list: {
        useInfiniteQuery: (...args: any[]) => useInfiniteQueryMock(...args),
        useQuery: (...args: any[]) => useQueryMock(...args),
      },
      create: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false, error: { message: 'Failed to create task' } }),
      },
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      setDueDate: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false, error: { message: 'Failed to set due date' } }),
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
  useInfiniteQueryMock.mockReset();
  useQueryMock.mockReset();
  fetchNextPageMock.mockReset();
  bulkUpdateMock.mockReset();
  bulkDeleteMock.mockReset();
  setStatusMock.mockReset();
  reorderMutate.mockReset();
  virtualizerMock.mockReset();
  virtualizerMock.mockReturnValue({ getTotalSize: () => 0, getVirtualItems: () => [] });
});

describe('TaskList', () => {
  it('shows loading skeleton when tasks are loading', () => {
    useInfiniteQueryMock.mockReturnValue({
      data: { pages: [] },
      isLoading: true,
      error: undefined,
      fetchNextPage: fetchNextPageMock,
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    useQueryMock.mockReturnValue({ data: [], isLoading: false, error: undefined });
    render(<TaskList />);
    expect(screen.getByLabelText('Loading tasks')).toBeInTheDocument();
  });

  it('renders archived count', () => {
    useInfiniteQueryMock.mockReturnValue({
      data: { pages: [defaultTasks] },
      isLoading: false,
      error: undefined,
      fetchNextPage: fetchNextPageMock,
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    useQueryMock.mockReturnValue({
      data: defaultTasks.filter((t) => t.status === 'DONE'),
      isLoading: false,
      error: undefined,
    });
    render(<TaskList />);
    expect(screen.getByText('1 archived')).toBeInTheDocument();
  });

  it('fetches next page when scrolled to bottom', () => {
    const page = Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, title: `Task ${i}`, dueAt: null } as any));
    useInfiniteQueryMock.mockReturnValue({
      data: { pages: [page] },
      isLoading: false,
      error: undefined,
      fetchNextPage: fetchNextPageMock,
      hasNextPage: true,
      isFetchingNextPage: false,
    });
    useQueryMock.mockReturnValue({ data: [], isLoading: false, error: undefined });
    virtualizerMock.mockReturnValue({
      getTotalSize: () => page.length * 60,
      getVirtualItems: () => page.map((_, i) => ({ index: i, start: i * 60, size: 60 })),
    });
    render(<TaskList />);
    const scroll = screen.getByTestId('task-scroll');
    Object.defineProperty(scroll, 'scrollTop', { value: 1000, writable: true });
    Object.defineProperty(scroll, 'scrollHeight', { value: 1100 });
    Object.defineProperty(scroll, 'clientHeight', { value: 100 });
    fireEvent.scroll(scroll);
    expect(fetchNextPageMock).toHaveBeenCalled();
  });

  it('renders tasks from multiple pages', () => {
    useInfiniteQueryMock.mockReturnValue({
      data: { pages: [[defaultTasks[0]], [defaultTasks[1]]] },
      isLoading: false,
      error: undefined,
      fetchNextPage: fetchNextPageMock,
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    useQueryMock.mockReturnValue({
      data: defaultTasks.filter((t) => t.status === 'DONE'),
      isLoading: false,
      error: undefined,
    });
    render(<TaskList />);
    expect(screen.getByText('Test 1')).toBeInTheDocument();
    expect(screen.queryByText('Test 2')).not.toBeInTheDocument();
  });

  it('filters tasks by priority', () => {
    render(<TaskList />);
    const select = screen.getByLabelText('Priority filter');
    fireEvent.change(select, { target: { value: 'HIGH' } });
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
