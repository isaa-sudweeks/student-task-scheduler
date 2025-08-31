// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import ProjectsPage from './page';

let createIsPending = false;
let updateIsPending = false;
let deleteIsPending = false;

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ project: { list: { invalidate: vi.fn() } } }),
    project: {
      list: {
        useQuery: () => ({
          data: [{ id: '1', title: 'Proj', description: null }],
        }),
      },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: createIsPending }) },
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: updateIsPending }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: deleteIsPending }) },
    },
  },
}));

afterEach(() => {
  cleanup();
  createIsPending = false;
  updateIsPending = false;
  deleteIsPending = false;
});

describe('ProjectsPage', () => {
  it('disables add button when creating', () => {
    createIsPending = true;
    render(<ProjectsPage />);
    const btn = screen.getByRole('button', { name: /saving/i });
    expect(btn).toBeDisabled();
  });

  it('disables save button when updating', () => {
    updateIsPending = true;
    render(<ProjectsPage />);
    const btn = screen.getByRole('button', { name: /saving/i });
    expect(btn).toBeDisabled();
  });

  it('disables delete button when deleting', () => {
    deleteIsPending = true;
    render(<ProjectsPage />);
    const btn = screen.getByRole('button', { name: /deleting/i });
    expect(btn).toBeDisabled();
  });
});

