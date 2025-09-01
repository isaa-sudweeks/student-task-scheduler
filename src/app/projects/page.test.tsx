// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import ProjectsPage from './page';

const createMock = vi.fn();
const updateMock = vi.fn();
let listData: Array<{ id: string; title: string; description: string | null; createdAt?: string } > = [];
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
    fireEvent.click(
      screen.getAllByRole('button', { name: /add project/i })[0],
    );
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
  it('shows empty state and focuses input when Add Project clicked', () => {
    render(<ProjectsPage />);
    expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
    const titleInput = screen.getByPlaceholderText('Project title');
    expect(titleInput).not.toHaveFocus();
    const buttons = screen.getAllByRole('button', { name: /add project/i });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    expect(titleInput).toHaveFocus();
  });

  it('resets fields to initial values when Cancel is clicked', () => {
    listData = [{ id: '1', title: 'Initial Title', description: 'Initial Description' }];
    render(<ProjectsPage />);
    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('listitem');
    const item = items[0];
    const titleInput = within(item).getAllByRole('textbox').find((el) => el.tagName === 'INPUT') as HTMLInputElement;
    const descInput = within(item).getAllByRole('textbox').find((el) => el.tagName === 'TEXTAREA') as HTMLTextAreaElement;

    fireEvent.change(titleInput, { target: { value: 'Changed Title' } });
    fireEvent.change(descInput, { target: { value: 'Changed Description' } });

    fireEvent.click(within(item).getByRole('button', { name: /cancel/i }));

    expect(titleInput.value).toBe('Initial Title');
    expect(descInput.value).toBe('Initial Description');
  });

  it('filters and sorts projects', () => {
    listData = [
      { id: '1', title: 'Alpha', description: '', createdAt: '2023-01-01T00:00:00Z' },
      { id: '2', title: 'Beta', description: '', createdAt: '2023-02-01T00:00:00Z' },
    ];
    render(<ProjectsPage />);
    const list = screen.getByRole('list');
    const titles = within(list)
      .getAllByRole('textbox')
      .filter((el) => el.tagName === 'INPUT')
      .map((i) => (i as HTMLInputElement).value);
    expect(titles).toEqual(['Beta', 'Alpha']);

    const sortSelect = screen.getByRole('combobox', { name: /sort by/i });
    fireEvent.change(sortSelect, { target: { value: 'title' } });
    const titlesSorted = within(list)
      .getAllByRole('textbox')
      .filter((el) => el.tagName === 'INPUT')
      .map((i) => (i as HTMLInputElement).value);
    expect(titlesSorted).toEqual(['Alpha', 'Beta']);

    const searchInput = screen.getByPlaceholderText('Search projects...');
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });
    const filtered = within(list)
      .getAllByRole('textbox')
      .filter((el) => el.tagName === 'INPUT')
      .map((i) => (i as HTMLInputElement).value);
    expect(filtered).toEqual(['Alpha']);
  });
});
