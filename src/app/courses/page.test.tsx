// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import CoursesPage from './page';

const mockCourses = [
  { id: '1', title: 'B', term: 'Summer', color: null },
  { id: '2', title: 'A', term: 'Winter', color: null },
];

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ course: { list: { invalidate: () => {} } } }),
    course: {
      list: { useQuery: () => ({ data: mockCourses }) },
      create: { useMutation: () => ({ mutate: () => {} }) },
      update: { useMutation: () => ({ mutate: () => {} }) },
      delete: { useMutation: () => ({ mutate: () => {} }) },
    },
  },
}));

describe('CoursesPage', () => {
  it('sorts courses by title by default and toggles to term', () => {
    render(<CoursesPage />);
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getAllByRole('textbox')[0]).toHaveValue('A');
    fireEvent.click(screen.getByRole('button', { name: /sort by term/i }));
    const itemsAfter = screen.getAllByRole('listitem');
    expect(within(itemsAfter[0]).getAllByRole('textbox')[0]).toHaveValue('B');
  });
});

