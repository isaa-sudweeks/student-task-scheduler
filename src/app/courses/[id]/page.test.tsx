// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import CoursePage from './page';

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ task: { list: { invalidate: vi.fn() } } }),
    user: { get: { useQuery: () => ({ data: { timezone: 'UTC' } }) } },
    course: {
      list: {
        useQuery: (_input: any, opts?: any) => {
          const courses = [{ id: 'c1', title: 'Course 1', term: 'Fall', color: '#000000' }];
          return { data: opts?.select ? opts.select(courses) : courses };
        },
      },
      update: { useMutation: () => ({ mutateAsync: vi.fn() }) },
    },
    task: {
      list: {
        useInfiniteQuery: () => ({
          data: { pages: [[{ id: 't1', title: 'Task 1', courseId: 'c1' }]] },
          isLoading: false,
          fetchNextPage: vi.fn(),
          hasNextPage: false,
          isFetchingNextPage: false,
        }),
        useQuery: () => ({ data: [] }),
      },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      setStatus: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      setDueDate: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      reorder: { useMutation: () => ({ mutate: vi.fn() }) },
    },
    project: { list: { useQuery: () => ({ data: [] }) } },
  },
}));

describe('CoursePage', () => {
  it('shows course details and tasks', () => {
    render(<CoursePage params={{ id: 'c1' }} />);
    expect(screen.getByText('Course 1')).toBeInTheDocument();
    expect(screen.getByLabelText(/upload syllabus/i)).toBeInTheDocument();
    expect(screen.getByText('Task 1')).toBeInTheDocument();
  });
});
