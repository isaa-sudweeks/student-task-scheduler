// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import HomePage from './page';

describe('HomePage', () => {
  it('shows a link to the calendar view', () => {
    render(<HomePage />);
    const link = screen.getByRole('link', { name: /calendar view/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/calendar');
  });
});

