// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { FloatingTaskButton } from './floating-task-button';

expect.extend(matchers);

const createMutation = { mutate: vi.fn(), isPending: false, error: undefined as any };
const updateMutation = { mutate: vi.fn(), isPending: false, error: undefined as any };
const deleteMutation = { mutate: vi.fn(), isPending: false, error: undefined as any };
const setStatusMutation = { mutate: vi.fn(), isPending: false, error: undefined as any };

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({
      task: {
        list: { invalidate: vi.fn() },
        listReminders: { invalidate: vi.fn() },
      },
    }),
    task: {
      subjectOptions: { useQuery: () => ({ data: [], isLoading: false }) },
      create: { useMutation: () => createMutation },
      update: { useMutation: () => updateMutation },
      delete: { useMutation: () => deleteMutation },
      setStatus: { useMutation: () => setStatusMutation },
      listReminders: { useQuery: () => ({ data: [], isLoading: false }) },
      replaceReminders: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false, error: undefined }) },
    },
    project: { list: { useQuery: () => ({ data: [] }) } },
    course: { list: { useQuery: () => ({ data: [] }) } },
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

describe('FloatingTaskButton', () => {
  it('opens TaskModal when clicked', () => {
    render(<FloatingTaskButton />);
    const button = screen.getByRole('button', { name: /add task/i });
    fireEvent.click(button);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
