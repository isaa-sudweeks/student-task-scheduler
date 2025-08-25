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
  },
}));

describe('HomePage', () => {
  it('shows a link to the calendar view', () => {
    render(<HomePage />);
    const link = screen.getByRole('link', { name: /calendar view/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/calendar');
  });
});
