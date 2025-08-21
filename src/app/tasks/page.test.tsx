// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import TasksPage from './page';

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ task: { list: { invalidate: vi.fn() } } }),
    task: {
      list: { useQuery: () => ({ data: [], isLoading: false }) },
      create: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
          error: undefined,
        }),
      },
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      setDueDate: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
          error: undefined,
        }),
      },
      delete: { useMutation: () => ({ mutate: vi.fn() }) },
      updateTitle: { useMutation: () => ({ mutate: vi.fn() }) },
      setStatus: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      reorder: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      bulkUpdate: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      bulkDelete: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
    },
  },
}));

afterEach(() => cleanup());

describe('TasksPage', () => {
  it('shows validation error when title is blank', () => {
    render(<TasksPage />);
    const input = screen.getByPlaceholderText('Add a task…');
    fireEvent.submit(input.closest('form')!);
    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(input, { target: { value: 'task' } });
    expect(screen.queryByText('Title is required')).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-invalid');
  });
});
