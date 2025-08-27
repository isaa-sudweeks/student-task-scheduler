// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
});
