// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { TaskList } from './task-list';
import type { RouterOutputs } from '@/server/api/root';
import { ErrorBoundary } from './error-boundary';

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
  useDndMonitor: vi.fn(),
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

const bulkUpdateMock = vi.fn();
const bulkDeleteMock = vi.fn();
const setStatusMock = vi.fn();
const reorderMutate = vi.fn();

const virtualizerMock = vi
  .fn()
  .mockReturnValue({ getTotalSize: () => 0, getVirtualItems: () => [] });

const createMutation = { mutate: vi.fn(), isPending: false, error: undefined as any };
const setDueMutation = { mutate: vi.fn(), isPending: false, error: undefined as any };
const updateMutation = { mutate: vi.fn(), isPending: false, error: undefined as any };
const deleteMutation = { mutate: vi.fn(), isPending: false, error: undefined as any };
const setStatusMutation = { mutate: setStatusMock, isPending: false, error: undefined as any };
const reorderMutation = { mutate: reorderMutate, isPending: false, error: undefined as any };
const bulkUpdateMutation = { mutate: bulkUpdateMock, isPending: false, error: undefined as any };
const bulkDeleteMutation = { mutate: bulkDeleteMock, isPending: false, error: undefined as any };

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ task: { list: { invalidate: vi.fn() } } }),
    task: {
      list: {
        useInfiniteQuery: (...args: any[]) => useInfiniteQueryMock(...args),
        useQuery: (...args: any[]) => useQueryMock(...args),
      },
      create: { useMutation: () => createMutation },
      update: { useMutation: () => updateMutation },
      setDueDate: { useMutation: () => setDueMutation },
      updateTitle: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      delete: { useMutation: () => deleteMutation },
      setStatus: { useMutation: () => setStatusMutation },
      reorder: { useMutation: () => reorderMutation },
      bulkUpdate: { useMutation: () => bulkUpdateMutation },
      bulkDelete: { useMutation: () => bulkDeleteMutation },
    },
    project: { list: { useQuery: () => ({ data: [] }) } },
    course: { list: { useQuery: () => ({ data: [] }) } },
    user: {
      get: { useQuery: () => ({ data: null, isLoading: false, error: undefined }) },
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
  triggerDragEnd = undefined;
  createMutation.error = undefined;
  setDueMutation.error = undefined;
  updateMutation.error = undefined;
  deleteMutation.error = undefined;
  setStatusMutation.error = undefined;
  reorderMutation.error = undefined;
  bulkUpdateMutation.error = undefined;
  bulkDeleteMutation.error = undefined;
});

describe('TaskList', () => {
  beforeEach(() => {
    useInfiniteQueryMock.mockReturnValue({
      data: { pages: [defaultTasks] },
      isLoading: false,
      error: undefined,
      fetchNextPage: fetchNextPageMock,
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    useQueryMock.mockReturnValue(defaultQuery);
  });
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

  it('renders fallback when mutation error occurs', () => {
    setDueMutation.error = new Error('boom');
    render(
      <ErrorBoundary fallback={<div>fallback</div>}>
        <TaskList />
      </ErrorBoundary>
    );
    expect(screen.getByText('fallback')).toBeInTheDocument();
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
    });
    render(<TaskList />);
    const input = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(input, { target: { value: 'Read' } });
    expect(screen.getByText('Read book')).toBeInTheDocument();
    expect(screen.queryByText('Math homework')).not.toBeInTheDocument();
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

  it('applies responsive max height for long lists', () => {
    const origWidth = window.innerWidth;
    Object.assign(window, { innerWidth: 375 });
    window.dispatchEvent(new Event('resize'));
    const manyTasks = Array.from({ length: 20 }, (_, i) => ({
      id: String(i + 1),
      title: `Task ${i + 1}`,
      dueAt: null,
      status: 'TODO',
    })) as any;
    useInfiniteQueryMock.mockReturnValue({
      data: { pages: [manyTasks] },
      isLoading: false,
      error: undefined,
      fetchNextPage: fetchNextPageMock,
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    useQueryMock.mockReturnValue({ data: [], isLoading: false, error: undefined });
    const { container } = render(<TaskList />);
    const scroll = screen.getByTestId('task-scroll');
    expect(scroll).toHaveClass('max-h-[50vh]');
    expect(scroll).toHaveClass('md:max-h-[600px]');
    expect(container).toMatchSnapshot();
    Object.assign(window, { innerWidth: origWidth });
    window.dispatchEvent(new Event('resize'));
  });
});
