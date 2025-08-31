// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import ProjectsPage from './page';

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ project: { list: { invalidate: vi.fn() } } }),
    project: {
      list: { useQuery: () => ({ data: [{ id: '1', title: 'Initial Title', description: 'Initial Description' }] }) },
      create: { useMutation: () => ({ mutate: vi.fn() }) },
      update: { useMutation: () => ({ mutate: vi.fn() }) },
      delete: { useMutation: () => ({ mutate: vi.fn() }) },
    },
  },
}));

describe('ProjectsPage', () => {
  it('resets fields to initial values when Cancel is clicked', () => {
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

