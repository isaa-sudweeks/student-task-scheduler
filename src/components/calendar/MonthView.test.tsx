// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import { MonthView } from './MonthView';

describe('MonthView', () => {
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
    render(<MonthView startOfWeek={new Date(iso)} events={[]} />);
    expect(screen.getAllByTestId('day-cell')).toHaveLength(count);
  });

  it('renders events inside the correct month day cell', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-05T12:00:00Z'));
    const events = [
      { id: 'e1', taskId: 't1', title: 'Math HW', startAt: '2024-05-10T09:00:00.000Z', endAt: '2024-05-10T10:00:00.000Z' },
      { id: 'e2', taskId: 't2', title: 'Science Project', startAt: '2024-05-10T14:00:00.000Z', endAt: '2024-05-10T15:00:00.000Z' },
      { id: 'e3', taskId: 't3', title: 'Piano', startAt: '2024-05-12T09:00:00.000Z', endAt: '2024-05-12T10:00:00.000Z' },
    ];
    render(<MonthView startOfWeek={new Date('2024-05-05T12:00:00Z')} events={events} />);
    expect(screen.getByText('Math HW')).toBeInTheDocument();
    expect(screen.getByText('Science Project')).toBeInTheDocument();
    expect(screen.getByText('Piano')).toBeInTheDocument();

    const may10Cell = screen.getByLabelText('month-day-2024-05-10');
    const may12Cell = screen.getByLabelText('month-day-2024-05-12');
    expect(may10Cell.querySelectorAll('[data-testid="month-event"]').length).toBe(2);
    expect(may12Cell.querySelectorAll('[data-testid="month-event"]').length).toBe(1);
  });

  it('renders multi-day events across days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-05T12:00:00Z'));
    const events = [
      {
        id: 'm1',
        taskId: 't1',
        title: 'Retreat',
        startAt: '2024-05-10T09:00:00.000Z',
        endAt: '2024-05-12T10:00:00.000Z',
      },
    ];
    render(<MonthView startOfWeek={new Date('2024-05-05T12:00:00Z')} events={events} />);
    ['2024-05-10', '2024-05-11', '2024-05-12'].forEach((d) => {
      const cell = screen.getByLabelText(`month-day-${d}`);
      expect(within(cell).getByText('Retreat')).toBeInTheDocument();
    });
  });

  it('highlights today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-15T09:00:00Z'));
    render(<MonthView startOfWeek={new Date('2024-05-01T00:00:00Z')} events={[]} />);
    expect(screen.getByTitle('Today')).toBeInTheDocument();
  });
});
