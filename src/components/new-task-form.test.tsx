// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { NewTaskForm } from './new-task-form';

let mutateSpy = vi.fn();

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ task: { list: { invalidate: vi.fn() } } }),
    task: {
      list: { useQuery: () => ({ data: [], isLoading: false }) },
      create: {
        useMutation: () => ({
          mutate: (...args: unknown[]) => (mutateSpy as any)(...args),
          isPending: false,
          error: { message: 'Failed to create task' },
        }),
      },
      setDueDate: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
          error: { message: 'Failed to set due date' },
        }),
      },
      delete: { useMutation: () => ({ mutate: vi.fn() }) },
      updateTitle: { useMutation: () => ({ mutate: vi.fn() }) },
      setStatus: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: { message: 'Failed to update status' } }) },
    },
  },
}));

afterEach(() => {
  cleanup();
  mutateSpy.mockReset();
});

describe('NewTaskForm', () => {
  it('shows error message when creation fails', () => {
    render(<NewTaskForm />);
    expect(screen.getByText('Failed to create task')).toBeInTheDocument();
  });

  it('displays validation error for blank title and clears on input', () => {
    render(<NewTaskForm />);
    const input = screen.getByPlaceholderText('Add a task…');
    fireEvent.submit(input.closest('form')!);
    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(input, { target: { value: 'task' } });
    expect(screen.queryByText('Title is required')).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('toggles due date picker with calendar icon', () => {
    render(<NewTaskForm />);
    const toggle = screen.getByLabelText('Toggle due date picker');
    expect(screen.queryByLabelText('Task due date')).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByLabelText('Task due date')).toBeInTheDocument();
  });

  it('submits subject when provided', () => {
    mutateSpy = vi.fn();
    render(<NewTaskForm />);
    const title = screen.getByPlaceholderText('Add a task…');
    const subject = screen.getByPlaceholderText('Subject (optional)');
    fireEvent.change(title, { target: { value: 'Do homework' } });
    fireEvent.change(subject, { target: { value: 'Math' } });
    fireEvent.submit(title.closest('form')!);
    expect(mutateSpy).toHaveBeenCalledWith({ title: 'Do homework', dueAt: null, subject: 'Math' });
  });

  it('omits subject when empty', () => {
    mutateSpy = vi.fn();
    render(<NewTaskForm />);
    const title = screen.getByPlaceholderText('Add a task…');
    fireEvent.change(title, { target: { value: 'Read book' } });
    fireEvent.submit(title.closest('form')!);
    expect(mutateSpy).toHaveBeenCalledWith({ title: 'Read book', dueAt: null });
  });
});
