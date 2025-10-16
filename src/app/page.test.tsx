// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

const TaskListMock = vi.fn();
const TaskFilterTabsMock = vi.fn();

vi.mock('@/components/task-list', () => ({
  TaskList: (props: any) => {
    TaskListMock(props);
    return <div data-testid="task-list" />;
  },
}));

vi.mock('@/components/task-filter-tabs', async () => {
  const actual = await vi.importActual<typeof import('@/components/task-filter-tabs')>(
    '@/components/task-filter-tabs'
  );
  return {
    ...actual,
    TaskFilterTabs: (props: any) => {
      TaskFilterTabsMock(props);
      return actual.TaskFilterTabs(props);
    },
  };
});

import HomePage from './page';
import NavBar from '@/components/nav-bar';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Test User', image: '' } } }),
  signOut: () => {},
}));

let mockSearch = '';
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

const defaultTaskListResponse = {
  data: [],
  isLoading: false,
  error: undefined,
};

const taskListQueryMock = vi.fn().mockReturnValue(defaultTaskListResponse);
const courseListMock = vi.fn().mockReturnValue({ data: [] });
const projectListMock = vi.fn().mockReturnValue({ data: [] });

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ task: { list: { invalidate: () => {} } } }),
    task: {
      list: {
        useInfiniteQuery: () => ({
          data: { pages: [[]] },
          isLoading: false,
          error: undefined,
          fetchNextPage: () => {},
          hasNextPage: false,
          isFetchingNextPage: false,
        }),
        useQuery: (...args: any[]) => taskListQueryMock(...args),
      },
      create: { useMutation: () => ({ mutate: () => {}, isPending: false, error: undefined }) },
      update: { useMutation: () => ({ mutate: () => {}, isPending: false, error: undefined }) },
      setDueDate: { useMutation: () => ({ mutate: () => {}, isPending: false, error: undefined }) },
      delete: { useMutation: () => ({ mutate: () => {}, isPending: false, error: undefined }) },
      setStatus: { useMutation: () => ({ mutate: () => {}, isPending: false, error: undefined }) },
      reorder: { useMutation: () => ({ mutate: () => {}, isPending: false, error: undefined }) },
      bulkUpdate: { useMutation: () => ({ mutate: () => {}, isPending: false, error: undefined }) },
      bulkDelete: { useMutation: () => ({ mutate: () => {}, isPending: false, error: undefined }) },
    },
    project: { list: { useQuery: (...args: any[]) => projectListMock(...args) } },
    course: { list: { useQuery: (...args: any[]) => courseListMock(...args) } },
    user: { get: { useQuery: () => ({ data: null, isLoading: false, error: undefined }) } },
  },
}));

describe('HomePage', () => {
  afterEach(() => {
    mockSearch = '';
    TaskListMock.mockClear();
    TaskFilterTabsMock.mockClear();
    taskListQueryMock.mockReset();
    taskListQueryMock.mockReturnValue(defaultTaskListResponse);
    courseListMock.mockReset();
    courseListMock.mockReturnValue({ data: [] });
    projectListMock.mockReset();
    projectListMock.mockReturnValue({ data: [] });
  });
  it('renders header with count, filters, search and new task button', () => {
    render(
      <>
        <NavBar />
        <HomePage />
      </>
    );
    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeInTheDocument();
    expect(screen.getByText('· 0')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search tasks...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new task/i })).toBeInTheDocument();
    const tablist = screen.getByRole('tablist', { name: /task filter/i });
    ['All', 'Today', 'Overdue', 'Archive'].forEach((label) => {
      expect(within(tablist).getByRole('tab', { name: label })).toBeInTheDocument();
    });
  });

  it('renders account menu button', () => {
    render(
      <>
        <NavBar />
        <HomePage />
      </>
    );
    expect(
      screen.getByRole('button', { name: /account menu/i })
    ).toBeInTheDocument();
  });

  it('focuses search on "/" key', () => {
    render(
      <>
        <NavBar />
        <HomePage />
      </>
    );
    const input = screen.getByPlaceholderText('Search tasks...') as HTMLInputElement;
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(window, { key: '/' });
    expect(document.activeElement).toBe(input);
  });

  it('cycles filter with ctrl+arrow keys', () => {
    render(
      <>
        <NavBar />
        <HomePage />
      </>
    );
    const allTab = screen.getByRole('tab', { name: 'All' });
    const todayTab = screen.getByRole('tab', { name: 'Today' });
    const overdueTab = screen.getByRole('tab', { name: 'Overdue' });

    expect(allTab).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true });
    expect(todayTab).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true });
    expect(overdueTab).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(window, { key: 'ArrowLeft', ctrlKey: true });
    expect(todayTab).toHaveAttribute('aria-selected', 'true');
  });

  it('shows shortcuts popover when clicking question mark', () => {
    render(
      <>
        <NavBar />
        <HomePage />
      </>
    );
    const btn = screen.getByRole('button', { name: /show shortcuts/i });
    fireEvent.click(btn);
    expect(screen.getByText('Create task')).toBeInTheDocument();
  });

  it('passes search params to task query', () => {
    mockSearch = 'status=DONE&subject=Math';
    render(
      <>
        <NavBar />
        <HomePage />
      </>
    );
    const call = TaskListMock.mock.calls.at(-1)?.[0];
    expect(call).toMatchObject({
      filter: 'all',
      status: 'DONE',
      subject: 'Math',
    });
  });

  it('updates task query when advanced filters change', () => {
    taskListQueryMock.mockReturnValue({
      data: [
        { id: 't1', subject: 'Math' },
        { id: 't2', subject: 'Science' },
      ],
      isLoading: false,
      error: undefined,
    });
    courseListMock.mockReturnValue({ data: [{ id: 'course-1', title: 'Course 1' }] });
    projectListMock.mockReturnValue({ data: [{ id: 'project-1', title: 'Project 1' }] });

    render(
      <>
        <NavBar />
        <HomePage />
      </>
    );

    const tabsProps = TaskFilterTabsMock.mock.calls.at(-1)?.[0];
    expect(tabsProps).toBeDefined();

    act(() => {
      tabsProps?.onSubjectChange?.('Math');
    });
    const subjectCall = TaskListMock.mock.calls.at(-1)?.[0];
    expect(subjectCall).toMatchObject({ subject: 'Math' });

    act(() => {
      tabsProps?.onPriorityChange?.('HIGH');
    });
    const priorityCall = TaskListMock.mock.calls.at(-1)?.[0];
    expect(priorityCall).toMatchObject({ priority: 'HIGH' });

    act(() => {
      tabsProps?.onCourseChange?.('course-1');
    });
    const courseCall = TaskListMock.mock.calls.at(-1)?.[0];
    expect(courseCall).toMatchObject({ courseId: 'course-1' });

    act(() => {
      tabsProps?.onProjectChange?.('project-1');
    });
    const projectCall = TaskListMock.mock.calls.at(-1)?.[0];
    expect(projectCall).toMatchObject({ projectId: 'project-1' });
  });
});
