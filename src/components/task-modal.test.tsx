// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { TaskModal } from './task-modal';
import type { RouterOutputs } from '@/server/api/root';

type Task = RouterOutputs['task']['list'][number];

expect.extend(matchers);

const mutateUpdate = vi.fn();
const mutateCreate = vi.fn();

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ task: { list: { invalidate: vi.fn() } } }),
    task: {
      create: { useMutation: () => ({ mutate: (...a: unknown[]) => mutateCreate(...a), isPending: false }) },
      update: { useMutation: () => ({ mutate: (...a: unknown[]) => mutateUpdate(...a), isPending: false }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      setStatus: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

describe('TaskModal due date editing', () => {
  beforeEach(() => {
    mutateUpdate.mockReset();
    mutateCreate.mockReset();
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

