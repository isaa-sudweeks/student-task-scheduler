// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import ProjectsPage from './page';

const createMock = vi.fn();
const updateMock = vi.fn();
let listData: Array<{ id: string; title: string; description: string | null }> = [];
let createIsPending = false;
let updateIsPending = false;
let deleteIsPending = false;
vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ project: { list: { invalidate: vi.fn() } } }),
    project: {
      list: { useQuery: () => ({ data: listData }) },
      create: { useMutation: () => ({ mutate: createMock, isPending: createIsPending }) },
      update: { useMutation: () => ({ mutate: updateMock, isPending: updateIsPending }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: deleteIsPending }) },
    },
  },
}));

beforeEach(() => {
  createMock.mockReset();
  updateMock.mockReset();
  listData = [];
  createIsPending = false;
  updateIsPending = false;
  deleteIsPending = false;
});

afterEach(() => {
  cleanup();
});

describe('ProjectsPage validation', () => {
  it('shows error when title too long', () => {
    render(<ProjectsPage />);
    fireEvent.change(screen.getByPlaceholderText('Project title'), {
      target: { value: 'a'.repeat(201) },
    });
    fireEvent.click(screen.getByRole('button', { name: /add project/i }));
    expect(
      screen.getByText(/title must be between 1 and 200 characters/i),
    ).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('shows error when description too long on update', () => {
    listData = [{ id: '1', title: 'Test', description: 'desc' }];
    render(<ProjectsPage />);
    const textarea = screen.getByDisplayValue('desc');
    fireEvent.change(textarea, { target: { value: 'a'.repeat(1001) } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(
      screen.getByText(/description must be at most 1000 characters/i),
    ).toBeInTheDocument();
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe('ProjectsPage loading states', () => {
  it('disables add button when creating', () => {
    createIsPending = true;
    render(<ProjectsPage />);
    const btn = screen.getByRole('button', { name: /saving/i });
    expect(btn).toBeDisabled();
  });

  it('disables save button when updating', () => {
    listData = [{ id: '1', title: 'Proj', description: null }];
    updateIsPending = true;
    render(<ProjectsPage />);
    const btn = screen.getByRole('button', { name: /saving/i });
    expect(btn).toBeDisabled();
  });

  it('disables delete button when deleting', () => {
    listData = [{ id: '1', title: 'Proj', description: null }];
    deleteIsPending = true;
    render(<ProjectsPage />);
    const btn = screen.getByRole('button', { name: /deleting/i });
    expect(btn).toBeDisabled();
  });
});

describe('ProjectsPage', () => {
  it('shows empty state message when no projects', () => {
    render(<ProjectsPage />);
    expect(
      screen.getByText('No projects yet—add one above.')
    ).toBeInTheDocument();
  });

  it('resets fields to initial values when Cancel is clicked', () => {
    listData = [{ id: '1', title: 'Initial Title', description: 'Initial Description' }];
    render(<ProjectsPage />);
    const inputs = screen.getAllByRole('textbox');
    const titleInput = inputs[2] as HTMLInputElement;
    const descInput = inputs[3] as HTMLTextAreaElement;

    fireEvent.change(titleInput, { target: { value: 'Changed Title' } });
    fireEvent.change(descInput, { target: { value: 'Changed Description' } });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(titleInput.value).toBe('Initial Title');
    expect(descInput.value).toBe('Initial Description');
  });
});
