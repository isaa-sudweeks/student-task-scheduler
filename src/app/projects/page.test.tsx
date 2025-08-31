// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import ProjectsPage from './page';

const createMock = vi.fn();
const updateMock = vi.fn();
const listData: { data: Array<{ id: string; title: string; description: string | null }> } = { data: [] };

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ project: { list: { invalidate: vi.fn() } } }),
    project: {
      list: { useQuery: () => ({ data: listData.data }) },
      create: { useMutation: () => ({ mutate: createMock }) },
      update: { useMutation: () => ({ mutate: updateMock }) },
      delete: { useMutation: () => ({ mutate: vi.fn() }) },
    },
  },
}));

describe('ProjectsPage validation', () => {
  beforeEach(() => {
    createMock.mockReset();
    updateMock.mockReset();
    listData.data = [];
  });

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
    listData.data = [{ id: '1', title: 'Test', description: 'desc' }];
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
