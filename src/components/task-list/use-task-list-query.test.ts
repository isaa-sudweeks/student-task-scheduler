// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

const useInfiniteQueryMock = vi.fn();

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
});

