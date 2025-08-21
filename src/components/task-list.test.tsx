// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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

const fetchNextPageMock = vi.fn();
const useInfiniteQueryMock = vi.fn();
const useQueryMock = vi.fn();
const bulkUpdateMock = vi.fn();
const bulkDeleteMock = vi.fn();
const setStatusMock = vi.fn();
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
      reorder: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
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
    expect(screen.getByText('Test 2')).toBeInTheDocument();
  });
});
