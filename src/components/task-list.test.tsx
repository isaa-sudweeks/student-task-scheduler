// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { TaskList } from './task-list';

const useInfiniteQueryMock = vi.fn();

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ task: { list: { invalidate: vi.fn() } } }),
    task: {
      list: {
        useInfiniteQuery: (...args: any[]) => useInfiniteQueryMock(...args),
      },
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      setDueDate: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      setStatus: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      reorder: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      bulkUpdate: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      bulkDelete: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
    },
    user: { get: { useQuery: () => ({ data: null, isLoading: false, error: undefined }) } },
  },
}));

describe('TaskList', () => {
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
        priority={null}
        courseId={null}
        projectId={null}
        query="Beta"
      />
    );
    expect(screen.getByText('No tasks.')).toBeInTheDocument();
  });
});
