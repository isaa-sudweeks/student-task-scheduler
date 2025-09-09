// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

import ThemeToggle from './theme-toggle';

expect.extend(matchers);

describe('ThemeToggle', () => {
  it('switches themes and persists via next-themes', async () => {
    vi.useRealTimers();
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <ThemeToggle />
      </ThemeProvider>
    );
    const button = await screen.findByRole('button', { name: 'Toggle theme' });
    fireEvent.click(button);
    await waitFor(() => {
      expect(localStorage.getItem('theme')).toBe('dark');
      expect(document.documentElement).toHaveClass('dark');
    });
    vi.useFakeTimers();
  });
});

