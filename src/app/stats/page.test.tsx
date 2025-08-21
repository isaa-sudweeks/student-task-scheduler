// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

vi.mock('@/server/api/react', () => ({
  api: {
    task: {
      list: {
        useQuery: vi.fn(),
      },
    },
  },
}));

import { api } from '@/server/api/react';
import StatsPage from './page';

const useQueryMock = api.task.list.useQuery as ReturnType<typeof vi.fn>;

expect.extend(matchers);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('StatsPage', () => {
  it('renders summary metrics', () => {
    useQueryMock.mockReturnValue({
      data: [
        { id: '1', status: 'TODO', subject: 'Math' },
        { id: '2', status: 'DONE', subject: 'Science' },
        { id: '3', status: 'DONE', subject: 'Math' },
      ],
      isLoading: false,
    });

    render(<StatsPage />);
    expect(screen.getByText('Total Tasks: 3')).toBeInTheDocument();
    expect(screen.getByText('Completion Rate: 67%')).toBeInTheDocument();
    expect(screen.getByText('TODO: 1')).toBeInTheDocument();
    expect(screen.getByText('DONE: 2')).toBeInTheDocument();
    expect(screen.getByText('Math: 2')).toBeInTheDocument();
    expect(screen.getByText('Science: 1')).toBeInTheDocument();
  });

  it('renders error message when query fails', () => {
    useQueryMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error('oops'),
    });

    render(<StatsPage />);
    expect(screen.getByText('Error loading tasks')).toBeInTheDocument();
  });
});
