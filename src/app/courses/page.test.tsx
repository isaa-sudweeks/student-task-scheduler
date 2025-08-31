// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import CoursesPage from './page';

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ course: { list: { invalidate: () => {} } } }),
    course: {
      list: {
        useQuery: () => ({
          data: [
            { id: '1', title: 'Math', term: null, color: null },
            { id: '2', title: 'History', term: null, color: null }
          ]
        })
      },
      create: { useMutation: () => ({ mutate: () => {} }) },
      update: { useMutation: () => ({ mutate: () => {} }) },
      delete: { useMutation: () => ({ mutate: () => {} }) }
    }
  }
}));

describe('CoursesPage', () => {
  it('filters courses by search input', () => {
    vi.useFakeTimers();
    render(<CoursesPage />);

    expect(screen.getByDisplayValue('Math')).toBeInTheDocument();
    expect(screen.getByDisplayValue('History')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Search courses...');
    fireEvent.change(input, { target: { value: 'math' } });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByDisplayValue('Math')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('History')).toBeNull();
    vi.useRealTimers();
  });
});
