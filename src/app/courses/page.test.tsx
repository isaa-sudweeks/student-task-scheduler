// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import CoursesPage from './page';

vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const createMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
let listData: Array<{ id: string; title: string; term: string | null; color: string | null; createdAt?: string }> = [];
let createIsPending = false;
let updateIsPending = false;
let deleteIsPending = false;

vi.mock('@/server/api/react', async () => {
  const actual = await vi.importActual<any>('@/server/api/react');
  return {
    api: {
      ...actual.api,
      useUtils: () => ({ course: { list: { invalidate: vi.fn() } } }),
      course: {
        list: { useQuery: () => ({ data: listData }) },
        create: { useMutation: () => ({ mutate: createMock, isPending: createIsPending }) },
        update: { useMutation: () => ({ mutate: updateMock, isPending: updateIsPending }) },
        delete: { useMutation: () => ({ mutate: deleteMock, isPending: deleteIsPending }) },
      },
    },
  };
});

beforeEach(() => {
  createMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();
  listData = [];
  createIsPending = false;
  updateIsPending = false;
  deleteIsPending = false;
});
afterEach(() => cleanup());
afterAll(() => vi.resetModules());

describe('CoursesPage', () => {
  it('shows empty state message when no courses', () => {
    render(<CoursesPage />);
    expect(screen.getByText('No courses yet.')).toBeInTheDocument();
  });

  it('filters and sorts courses', () => {
    listData = [
      { id: '1', title: 'Alpha', term: 'Fall', color: null, createdAt: '2023-01-01T00:00:00Z' },
      { id: '2', title: 'Beta', term: 'Spring', color: null, createdAt: '2023-02-01T00:00:00Z' },
    ];
    render(<CoursesPage />);
    const list = screen.getByRole('list');
    const titles = within(list)
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent);
    expect(titles).toEqual(['Beta', 'Alpha']);

    const sortSelect = screen.getByRole('combobox', { name: /sort by/i });
    fireEvent.change(sortSelect, { target: { value: 'title' } });
    const titlesSorted = within(list)
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent);
    expect(titlesSorted).toEqual(['Alpha', 'Beta']);

    const searchInput = screen.getByPlaceholderText('Search courses...');
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });
    const filtered = within(list)
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent);
    expect(filtered).toEqual(['Alpha']);
  });

  it('opens edit modal when clicking edit icon', () => {
    listData = [{ id: '1', title: 'Math', term: null, color: null }];
    render(<CoursesPage />);
    fireEvent.click(screen.getByRole('button', { name: /edit course/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

