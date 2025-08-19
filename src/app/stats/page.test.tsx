// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import StatsPage from './page';

vi.mock('@/server/api/react', () => ({
  api: {
    task: {
      list: {
        useQuery: () => ({
          data: [
            { id: '1', status: 'TODO', subject: 'Math' },
            { id: '2', status: 'DONE', subject: 'Science' },
            { id: '3', status: 'DONE', subject: 'Math' },
          ],
          isLoading: false,
        }),
      },
    },
  },
}));

afterEach(() => cleanup());

describe('StatsPage', () => {
  it('renders summary metrics', () => {
    render(<StatsPage />);
    expect(screen.getByText('Total Tasks: 3')).toBeInTheDocument();
    expect(screen.getByText('Completion Rate: 67%')).toBeInTheDocument();
    expect(screen.getByText('TODO: 1')).toBeInTheDocument();
    expect(screen.getByText('DONE: 2')).toBeInTheDocument();
    expect(screen.getByText('Math: 2')).toBeInTheDocument();
    expect(screen.getByText('Science: 1')).toBeInTheDocument();
  });
});
