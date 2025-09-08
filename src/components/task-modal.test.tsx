// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { TaskModal } from './task-modal';
import type { RouterOutputs } from '@/server/api/root';
import { ErrorBoundary } from './error-boundary';

type Task = RouterOutputs['task']['list'][number];

expect.extend(matchers);

const mutateUpdate = vi.fn();
const mutateCreate = vi.fn();

const createMutation = { mutate: (...a: unknown[]) => mutateCreate(...a), isPending: false, error: undefined as any };
const updateMutation = { mutate: (...a: unknown[]) => mutateUpdate(...a), isPending: false, error: undefined as any };
const deleteMutation = { mutate: vi.fn(), isPending: false, error: undefined as any };
const setStatusMutation = { mutate: vi.fn(), isPending: false, error: undefined as any };

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ task: { list: { invalidate: vi.fn() } } }),
    task: {
      create: { useMutation: () => createMutation },
      update: { useMutation: () => updateMutation },
      delete: { useMutation: () => deleteMutation },
      setStatus: { useMutation: () => setStatusMutation },
      list: { useQuery: () => ({ data: [] }) },
    },
    project: { list: { useQuery: () => ({ data: [{ id: 'p1', title: 'Project 1' }] }) } },
    course: {
      list: {
        useQuery: () => ({
          data: [{ id: 'c1', title: 'Course 1', term: null, color: null, nextDueAt: null }],
        }),
      },
    },
  },
}));

describe('TaskModal due date editing', () => {
  beforeEach(() => {
    mutateUpdate.mockReset();
    mutateCreate.mockReset();
    createMutation.error = undefined;
    updateMutation.error = undefined;
    deleteMutation.error = undefined;
    setStatusMutation.error = undefined;
  });

  it('adds a due date to a task that previously had none when saving', () => {
    const task = { id: 't1', title: 'Write essay', subject: null, notes: null, dueAt: null } as Task;
    render(
      <TaskModal open mode="edit" onClose={() => {}} task={task} />
    );

    // Enable due date
    const dueToggle = screen.getByLabelText('Set due date');
    fireEvent.click(dueToggle);

    // Ensure the datetime-local input is enabled and has a value
    const input = screen.getByDisplayValue(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/) as HTMLInputElement;
    // Change to a specific value to make assertion stable
    fireEvent.change(input, { target: { value: '2099-12-31T23:59' } });

    // Save
    fireEvent.click(screen.getByText('Save'));

    expect(mutateUpdate).toHaveBeenCalledTimes(1);
    const arg = mutateUpdate.mock.calls[0][0] as { id: string; dueAt: Date };
    expect(arg.id).toBe('t1');
    expect(arg.dueAt).toBeInstanceOf(Date);
    // The local time parsed should match the chosen fields
    const d = arg.dueAt as Date;
    expect(d.getFullYear()).toBe(2099);
    expect(d.getMonth()).toBe(11); // 0-indexed
    expect(d.getDate()).toBe(31);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
  });

});

describe('TaskModal status changes', () => {
  beforeEach(() => {
    setStatusMutation.mutate.mockReset();
    setStatusMutation.error = undefined;
  });

  it('calls setStatus when status is updated', () => {
    const task = { id: 't1', title: 'Write essay', status: 'TODO', subject: null, notes: null, dueAt: null } as Task;
    const onClose = vi.fn();
    render(<TaskModal open mode="edit" onClose={onClose} task={task} />);

    fireEvent.click(screen.getByLabelText('Change status'));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(setStatusMutation.mutate).toHaveBeenCalledWith({ id: 't1', status: 'DONE' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('TaskModal validation', () => {
  beforeEach(() => {
    mutateCreate.mockReset();
    createMutation.error = undefined;
  });

  it('shows an error when title is missing', () => {
    render(<TaskModal open mode="create" onClose={() => {}} />);
    fireEvent.click(screen.getByText('Create'));
    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(mutateCreate).not.toHaveBeenCalled();
  });
});

  describe('TaskModal project and course selection', () => {
  beforeEach(() => {
    mutateCreate.mockReset();
    createMutation.error = undefined;
  });
    it('sends selected project and course when creating', () => {
      render(<TaskModal open mode="create" onClose={() => {}} />);
      fireEvent.change(screen.getByPlaceholderText('Task title'), { target: { value: 'T' } });
      fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'p1' } });
      fireEvent.change(screen.getByLabelText('Course'), { target: { value: 'c1' } });
      fireEvent.click(screen.getByText('Create'));
      expect(mutateCreate).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'T', projectId: 'p1', courseId: 'c1' })
      );
    });

    it('preselects initial project when provided', () => {
      render(<TaskModal open mode="create" onClose={() => {}} initialProjectId="p1" />);
      const select = screen.getByLabelText('Project') as HTMLSelectElement;
      expect(select.value).toBe('p1');
    });

    it('preselects initial course when provided', () => {
      render(<TaskModal open mode="create" onClose={() => {}} initialCourseId="c1" />);
      const select = screen.getByLabelText('Course') as HTMLSelectElement;
      expect(select.value).toBe('c1');
    });
  });

describe('TaskModal accessibility', () => {
  beforeEach(() => {
    createMutation.error = undefined;
  });
  it('traps focus within the modal and focuses the first element initially', () => {
    const onClose = vi.fn();
    render(<TaskModal open mode="create" onClose={onClose} />);

    const titleInput = screen.getByPlaceholderText('Task title');
    expect(document.activeElement).toBe(titleInput);

    const createButton = screen.getByText('Create');
    createButton.focus();
    fireEvent.keyDown(createButton, { key: 'Tab' });
    expect(document.activeElement).toBe(titleInput);

    fireEvent.keyDown(titleInput, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(createButton);
  });

  it('invokes onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<TaskModal open mode="create" onClose={onClose} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('TaskModal subtasks', () => {
  beforeEach(() => {
    mutateCreate.mockReset();
    createMutation.error = undefined;
  });

  it('creates a subtask for the given parent', () => {
    const task = { id: 't1', title: 'Parent', subject: null, notes: null, dueAt: null } as Task;
    render(<TaskModal open mode="edit" onClose={() => {}} task={task} />);
    fireEvent.change(screen.getByPlaceholderText('New subtask'), { target: { value: 'Child' } });
    fireEvent.click(screen.getByText('Add subtask'));
    expect(mutateCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Child', parentId: 't1' })
    );
  });
});

