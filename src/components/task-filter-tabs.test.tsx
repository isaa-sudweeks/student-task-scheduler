// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { TaskFilterTabs } from './task-filter-tabs';

expect.extend(matchers);

describe('TaskFilterTabs', () => {
  it('calls onChange with selected filter', () => {
    const handleChange = vi.fn();
    render(<TaskFilterTabs value="all" onChange={handleChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Overdue' }));
    expect(handleChange).toHaveBeenCalledWith('overdue');
  });
});
