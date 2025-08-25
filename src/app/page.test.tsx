// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import HomePage from './page';

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
        useQuery: () => ({ data: [], isLoading: false, error: undefined }),
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
    project: { list: { useQuery: () => ({ data: [] }) } },
    course: { list: { useQuery: () => ({ data: [] }) } },
    user: { get: { useQuery: () => ({ data: null, isLoading: false, error: undefined }) } },
  },
}));

describe('HomePage', () => {
  it('renders search and new task controls', () => {
    render(<HomePage />);
    expect(screen.getByPlaceholderText('Search tasks...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new task/i })).toBeInTheDocument();
  });
});
