// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import HomePage from './page';

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ task: { list: { invalidate: vi.fn() } } }),
    task: {
      list: { useQuery: () => ({ data: [], isLoading: false }) },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: undefined }) },
      saveSubscription: { useMutation: () => ({ mutateAsync: vi.fn() }) },
    },
  },
}));

describe('HomePage', () => {
  it('shows a link to the calendar view', () => {
    render(<HomePage />);
    const link = screen.getByRole('link', { name: /calendar view/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/calendar');
  });
});

