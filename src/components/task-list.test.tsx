// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { TaskList } from './task-list';

const useInfiniteQueryMock = vi.fn();
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: {} }) }));

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ task: { list: { invalidate: vi.fn() } } }),
    task: {
      list: {
        useInfiniteQuery: (...args: any[]) => useInfiniteQueryMock(...args),
        useQuery: () => ({ data: [], isLoading: false, error: undefined }),
      },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      setDueDate: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      setStatus: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      reorder: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
    },
    project: { list: { useQuery: () => ({ data: [], isLoading: false, error: undefined }) } },
    course: { list: { useQuery: () => ({ data: [], isLoading: false, error: undefined }) } },
    user: { get: { useQuery: () => ({ data: null, isLoading: false, error: undefined }) } },
  },
}));

describe('TaskList', () => {
  it('matches query against subject and highlights the subject text', () => {
    useInfiniteQueryMock.mockReturnValue({
      data: {
        pages: [[
          {
            id: '1',
            title: 'Alpha',
            subject: 'Physics',
            notes: 'Review weekly lecture notes.',
            dueAt: null,
            status: 'TODO',
          },
        ]],
      },
      isLoading: false,
      error: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    const { container } = render(
      <TaskList
        filter="all"
        subject={null}
        status={null}
        priority={null}
        courseId={null}
        projectId={null}
        query="Physics"
      />
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    const highlighted = Array.from(container.querySelectorAll('mark')).map(
      (el) => el.textContent
    );
    expect(highlighted).toContain('Physics');
  });

  it('matches query against notes and renders a highlighted snippet', () => {
    useInfiniteQueryMock.mockReturnValue({
      data: {
        pages: [[
          {
            id: '1',
            title: 'Alpha',
            subject: 'Physics',
            notes: 'Review the outline for the upcoming presentation.',
            dueAt: null,
            status: 'TODO',
          },
        ]],
      },
      isLoading: false,
      error: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    render(
      <TaskList
        filter="all"
        subject={null}
        status={null}
        priority={null}
        courseId={null}
        projectId={null}
        query="outline"
      />
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    const snippet = screen.getByTestId('task-notes-snippet');
    expect(snippet.querySelector('mark')?.textContent).toBe('outline');
  });

  it('filters tasks based on query prop', () => {
    useInfiniteQueryMock.mockReturnValue({
      data: { pages: [[{ id: '1', title: 'Alpha', dueAt: null, status: 'TODO' }]] },
      isLoading: false,
      error: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    render(
      <TaskList
        filter="all"
        subject={null}
        status={null}
        priority={null}
        courseId={null}
        projectId={null}
        query="Beta"
      />
    );
    expect(screen.getByText('Create your first task')).toBeInTheDocument();
  });

  it.skip('moves selection with j key', () => {
    useInfiniteQueryMock.mockReturnValue({
      data: {
        pages: [[
          { id: '1', title: 'Alpha', dueAt: null, status: 'TODO' },
          { id: '2', title: 'Beta', dueAt: null, status: 'TODO' },
        ]],
      },
      isLoading: false,
      error: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    render(
      <TaskList
        filter="all"
        subject={null}
        status={null}
        priority={null}
        courseId={null}
        projectId={null}
        query=""
      />
    );
    const list = screen.getByRole('listbox');
    const items = screen.getAllByRole('option');
    expect(items[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(list, { key: 'j' });
    expect(items[1]).toHaveAttribute('aria-selected', 'true');
  });
  it('shows red due date text for overdue tasks', () => {
    const now = new Date('2023-01-02T12:00:00Z');
    vi.setSystemTime(now);
    useInfiniteQueryMock.mockReturnValue({
      data: {
        pages: [[{ id: '1', title: 'Alpha', dueAt: new Date('2023-01-01T12:00:00Z'), status: 'TODO' }]],
      },
      isLoading: false,
      error: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    render(
      <TaskList
        filter="all"
        subject={null}
        status={null}
        priority={null}
        courseId={null}
        projectId={null}
        query=""
      />
    );
    expect(screen.getByTestId('due-date')).toHaveClass('text-red-600');
    vi.useRealTimers();
  });

  it('shows amber due date text for tasks due today', () => {
    const now = new Date('2023-01-02T12:00:00Z');
    vi.setSystemTime(now);
    useInfiniteQueryMock.mockReturnValue({
      data: {
        pages: [[{ id: '1', title: 'Alpha', dueAt: new Date('2023-01-02T15:00:00Z'), status: 'TODO' }]],
      },
      isLoading: false,
      error: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    render(
      <TaskList
        filter="all"
        subject={null}
        status={null}
        priority={null}
        courseId={null}
        projectId={null}
        query=""
      />
    );
    expect(screen.getByTestId('due-date')).toHaveClass('text-amber-600');
    vi.useRealTimers();
  });

  it('shows neutral due date text for future tasks', () => {
    const now = new Date('2023-01-02T12:00:00Z');
    vi.setSystemTime(now);
    useInfiniteQueryMock.mockReturnValue({
      data: {
        pages: [[{ id: '1', title: 'Alpha', dueAt: new Date('2023-01-03T12:00:00Z'), status: 'TODO' }]],
      },
      isLoading: false,
      error: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    render(
      <TaskList
        filter="all"
        subject={null}
        status={null}
        priority={null}
        courseId={null}
        projectId={null}
        query=""
      />
    );
    expect(screen.getByTestId('due-date')).toHaveClass('text-neutral-500');
    vi.useRealTimers();
  });

  it('renders subtasks indented under parent', () => {
    useInfiniteQueryMock.mockReturnValue({
      data: {
        pages: [[
          { id: '1', title: 'Parent', dueAt: null, status: 'TODO' },
          { id: '2', title: 'Child', dueAt: null, status: 'TODO', parentId: '1' },
        ]],
      },
      isLoading: false,
      error: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    render(
      <TaskList
        filter="all"
        subject={null}
        status={null}
        priority={null}
        courseId={null}
        projectId={null}
        query=""
      />
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Parent');
    expect(items[1]).toHaveTextContent('Child');
    expect(items[1]).toHaveStyle({ marginLeft: '16px' });
  });
});
