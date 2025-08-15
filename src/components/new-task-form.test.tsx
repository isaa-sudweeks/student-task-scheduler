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
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
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
  it('submits on Enter with title only', () => {
    mutateSpy = vi.fn();
    render(<NewTaskForm />);
    const input = screen.getByPlaceholderText('Add a task…');
    fireEvent.change(input, { target: { value: 'Do homework' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mutateSpy).toHaveBeenCalledWith({ title: 'Do homework' });
  });

  it('does not submit when title is blank', () => {
    mutateSpy = vi.fn();
    render(<NewTaskForm />);
    const input = screen.getByPlaceholderText('Add a task…');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mutateSpy).not.toHaveBeenCalled();
  });

  it('opens modal on More options and shows draft due hint when setting due in modal', () => {
    render(<NewTaskForm />);
    // Open modal
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    // Toggle due date checkbox
    const dueToggle = screen.getByLabelText('Set due date');
    fireEvent.click(dueToggle);
    // Change due date value
    const dueInput = screen.getByDisplayValue(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    fireEvent.change(dueInput, { target: { value: '2099-12-31T23:59' } });
    // Hint should appear in the form outside the modal
    expect(screen.getByText(/Due /)).toBeInTheDocument();
    // Disable due and ensure hint disappears
    fireEvent.click(dueToggle);
    expect(screen.queryByText(/Due /)).not.toBeInTheDocument();
  });
});
