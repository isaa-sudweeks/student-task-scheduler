// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import ProjectsPage from './page';

const mockProjects = [
  { id: '1', title: 'Alpha', description: '', createdAt: '2023-01-01T00:00:00Z' },
  { id: '2', title: 'Beta', description: '', createdAt: '2023-02-01T00:00:00Z' },
];

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ project: { list: { invalidate: vi.fn() } } }),
    project: {
      list: { useQuery: () => ({ data: mockProjects }) },
      create: { useMutation: () => ({ mutate: vi.fn() }) },
      update: { useMutation: () => ({ mutate: vi.fn() }) },
      delete: { useMutation: () => ({ mutate: vi.fn() }) },
    },
  },
}));

afterEach(() => cleanup());

describe('ProjectsPage', () => {
  it('filters and sorts projects', () => {
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
