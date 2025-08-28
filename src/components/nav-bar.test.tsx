// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import NavBar from './nav-bar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/calendar',
}));

expect.extend(matchers);

describe('NavBar', () => {
  it('highlights the active route', () => {
    render(<NavBar />);
    const active = screen.getByRole('link', { name: 'Calendar' });
    const inactive = screen.getByRole('link', { name: 'Projects' });
    expect(active).toHaveClass('text-blue-600');
    expect(inactive).not.toHaveClass('text-blue-600');
  });
});
