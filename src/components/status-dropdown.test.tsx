// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { StatusDropdown } from './status-dropdown';

describe('StatusDropdown', () => {
  it('uses soft background colors for each status', () => {
    const { rerender } = render(
      <StatusDropdown value="TODO" onChange={() => {}} />
    );
    expect(screen.getByRole('button')).toHaveClass('bg-neutral-100');

    rerender(<StatusDropdown value="IN_PROGRESS" onChange={() => {}} />);
    expect(screen.getByRole('button')).toHaveClass('bg-amber-50');

    rerender(<StatusDropdown value="DONE" onChange={() => {}} />);
    expect(screen.getByRole('button')).toHaveClass('bg-emerald-50');
  });

  it('supports keyboard navigation and selection', async () => {
    vi.useRealTimers();
    const handleChange = vi.fn();
    render(<StatusDropdown value="TODO" onChange={handleChange} />);
    const user = userEvent.setup();

    const toggle = screen.getByRole('button', { name: 'Change status' });

    toggle.focus();
    await user.keyboard('[Enter]');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('[ArrowDown]');
    await user.keyboard('[Enter]');

    expect(handleChange).toHaveBeenCalledWith('IN_PROGRESS');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    toggle.focus();
    await user.keyboard('[Enter]');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('[Escape]');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    vi.useFakeTimers();
  });
});
