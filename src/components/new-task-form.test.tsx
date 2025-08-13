// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { NewTaskForm } from './new-task-form';

const createMutate = vi.fn();

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ task: { list: { invalidate: vi.fn() } } }),
    task: {
      list: { useQuery: () => ({ data: [], isLoading: false }) },
      create: {
        useMutation: () => ({
          mutate: createMutate,
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
  createMutate.mockReset();
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

  it('focuses title input on Enter when no input is active', () => {
    render(<NewTaskForm />);
    const input = screen.getByPlaceholderText('Add a task…') as HTMLInputElement;
    input.blur();
    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(document.activeElement).toBe(input);
  });

  it('submits form on Ctrl+Enter and prevents default', () => {
    render(<NewTaskForm />);
    const input = screen.getByPlaceholderText('Add a task…');
    fireEvent.change(input, { target: { value: 'task' } });
    const event = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(createMutate).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });
});
