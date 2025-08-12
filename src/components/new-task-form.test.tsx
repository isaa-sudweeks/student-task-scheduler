// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { NewTaskForm } from './new-task-form';

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ task: { list: { invalidate: vi.fn() } } }),
    task: {
      create: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
          error: { message: 'Failed to create task' },
        }),
      },
    },
  },
}));

describe('NewTaskForm', () => {
  it('shows error message when creation fails', () => {
    render(<NewTaskForm />);
    expect(screen.getByText('Failed to create task')).toBeInTheDocument();
  });
});
