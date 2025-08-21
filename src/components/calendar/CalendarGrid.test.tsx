import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { CalendarGrid } from './CalendarGrid';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('CalendarGrid month view', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it.each([
    ['2023-02-01', 28],
    ['2024-04-01', 30],
    ['2024-05-01', 31],
  ])('renders all days for %s', (iso, count) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
    render(<CalendarGrid view="month" events={[]} onDropTask={() => {}} />);
    expect(screen.getAllByTestId('day-cell')).toHaveLength(count);
  });
});
