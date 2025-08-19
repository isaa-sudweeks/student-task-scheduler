// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { TaskFilterTabs } from './task-filter-tabs';

vi.mock('@/server/api/react', () => ({
  api: {
    task: {
      list: {
        useQuery: () => ({
          data: [
            { id: '1', subject: 'math' },
            { id: '2', subject: 'science' },
            { id: '3', subject: null },
          ],
          isLoading: false,
          error: undefined,
        }),
      },
    },
  },
}));

expect.extend(matchers);

describe('TaskFilterTabs', () => {
  it('calls onChange with selected filter', () => {
    const handleChange = vi.fn();
    render(<TaskFilterTabs value="all" onChange={handleChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Overdue' }));
    expect(handleChange).toHaveBeenCalledWith('overdue');
  });

  it('renders subject options and calls onSubjectChange', () => {
    const handleSubject = vi.fn();
    render(
      <TaskFilterTabs
        value="all"
        onChange={() => {}}
        subject={null}
        onSubjectChange={handleSubject}
      />
    );
    const select = screen.getByLabelText('Subject filter');
    fireEvent.change(select, { target: { value: 'math' } });
    expect(handleSubject).toHaveBeenCalledWith('math');
    expect(screen.getByRole('option', { name: 'science' })).toBeInTheDocument();
  });
});
