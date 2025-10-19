// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

const useInfiniteQueryMock = vi.fn();

beforeEach(() => {
  useInfiniteQueryMock.mockReset();
});

vi.mock('@/server/api/react', () => ({
  api: {
    user: { get: { useQuery: () => ({ data: null }) } },
    task: { list: { useInfiniteQuery: (...args: any[]) => useInfiniteQueryMock(...args) } },
  },
}));

vi.mock('next-auth/react', () => ({ useSession: () => ({ data: {} }) }));

import { useTaskListQuery } from './use-task-list-query';

describe('useTaskListQuery', () => {
  it('returns flattened tasks', () => {
    useInfiniteQueryMock.mockReturnValue({
      data: { pages: [[{ id: '1', title: 'Alpha', status: 'TODO' }]] },
      isLoading: false,
      error: undefined,
    });
    const { result } = renderHook(() =>
      useTaskListQuery({
        filter: 'all',
        subject: null,
        status: null,
        priority: null,
        courseId: null,
        projectId: null,
      })
    );
    expect(result.current.flatTasks).toHaveLength(1);
  });

  it('clears snapshot when data becomes empty', () => {
    const queryResult = {
      isLoading: false,
      error: undefined,
    };
    let pages: any[] = [[{ id: '1', title: 'Alpha', status: 'TODO' }]];
    useInfiniteQueryMock.mockImplementation(() => ({
      data: { pages },
      ...queryResult,
    }));

    const { result, rerender } = renderHook(
      ({ filter }: { filter: 'all' }) =>
        useTaskListQuery({
          filter,
          subject: null,
          status: null,
          priority: null,
          courseId: null,
          projectId: null,
        }),
      { initialProps: { filter: 'all' as const } }
    );

    expect(result.current.taskData).toHaveLength(1);

    pages = [[]];
    rerender({ filter: 'all' });

    expect(result.current.flatTasks).toHaveLength(0);
    expect(result.current.taskData).toHaveLength(0);
  });
});

