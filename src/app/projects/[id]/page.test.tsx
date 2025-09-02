// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import ProjectPage from './page';

const updateMock = vi.fn();

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ task: { list: { invalidate: vi.fn() } } }),
    user: { get: { useQuery: () => ({ data: { timezone: 'UTC' } }) } },
    project: {
      get: { useQuery: () => ({ data: { id: 'p1', title: 'Project 1', description: 'Desc', instructionsUrl: null } }) },
      list: { useQuery: () => ({ data: [{ id: 'p1', title: 'Project 1' }] }) },
      update: { useMutation: () => ({ mutateAsync: updateMock }) },
    },
    task: {
      list: {
        useInfiniteQuery: () => ({
          data: { pages: [[{ id: 't1', title: 'Task 1', projectId: 'p1' }]] },
          isLoading: false,
          fetchNextPage: vi.fn(),
          hasNextPage: false,
          isFetchingNextPage: false,
        }),
      },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      setStatus: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
    },
    course: { list: { useQuery: () => ({ data: [] }) } },
  },
}));

describe('ProjectPage', () => {
  it('shows details, upload, and tasks; preselects project for new tasks', () => {
    render(<ProjectPage params={{ id: 'p1' }} />);
    expect(screen.getByText('Desc')).toBeInTheDocument();
    expect(screen.getByLabelText(/upload instructions/i)).toBeInTheDocument();
    expect(screen.getByText('Task 1')).toBeInTheDocument();
    fireEvent.click(screen.getByText('+ Add Task'));
    const select = screen.getByLabelText('Project') as HTMLSelectElement;
    expect(select.value).toBe('p1');
  });
});
