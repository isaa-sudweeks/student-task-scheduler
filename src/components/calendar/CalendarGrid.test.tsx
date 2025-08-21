// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

let dndDragEnd: ((e: any) => void) | undefined;
const transforms = new Map<string, (t: any) => void>();
const monitors: any[] = [];

vi.mock('@dnd-kit/core', () => {
  const React = require('react');
  return {
    DndContext: ({ children, onDragEnd }: any) => {
      dndDragEnd = onDragEnd;
      return <div>{children}</div>;
    },
    useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
    useDraggable: ({ id }: any) => {
      const [transform, setTransform] = React.useState<any>(null);
      React.useEffect(() => {
        transforms.set(id, setTransform);
      }, [id]);
      return { attributes: {}, listeners: {}, setNodeRef: () => {}, transform };
    },
    useDndMonitor: (cb: any) => {
      monitors.push(cb);
    },
  };
});

afterAll(() => {
  vi.unmock('@dnd-kit/core');
});

import { CalendarGrid } from './CalendarGrid';
import { DndContext } from '@dnd-kit/core';

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

  it('renders events inside the correct month day cell', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-05T12:00:00Z'));
    const events = [
      { id: 'e1', taskId: 't1', title: 'Math HW', startAt: '2024-05-10T09:00:00.000Z', endAt: '2024-05-10T10:00:00.000Z' },
      { id: 'e2', taskId: 't2', title: 'Science Project', startAt: '2024-05-10T14:00:00.000Z', endAt: '2024-05-10T15:00:00.000Z' },
      { id: 'e3', taskId: 't3', title: 'Piano', startAt: '2024-05-12T09:00:00.000Z', endAt: '2024-05-12T10:00:00.000Z' },
    ];
    render(<CalendarGrid view="month" events={events} onDropTask={() => {}} />);
    expect(screen.getByText('Math HW')).toBeInTheDocument();
    expect(screen.getByText('Science Project')).toBeInTheDocument();
    expect(screen.getByText('Piano')).toBeInTheDocument();

    const may10Cell = screen.getByLabelText('month-day-2024-05-10');
    const may12Cell = screen.getByLabelText('month-day-2024-05-12');
    expect(may10Cell.querySelectorAll('[data-testid="month-event"]').length).toBe(2);
    expect(may12Cell.querySelectorAll('[data-testid="month-event"]').length).toBe(1);
  });
});

describe('CalendarGrid interactions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2099-01-01T00:00:00Z'));
  });
  afterEach(() => {
    cleanup();
    transforms.clear();
    monitors.length = 0;
    vi.useRealTimers();
  });

  it('calls onDropTask when a task is dropped onto a cell', () => {
    const onDropTask = vi.fn();
    render(
      <DndContext
        onDragEnd={(e: any) => {
          const { active, over } = e;
          if (!over) return;
          const taskId = String(active.id).replace('task-', '');
          const iso = String(over.id).replace('cell-', '');
          onDropTask(taskId, new Date(iso));
        }}
      >
        <CalendarGrid view="day" events={[]} onDropTask={onDropTask} />
      </DndContext>
    );
    const iso = new Date('2099-01-01T08:00:00.000Z').toISOString();
    dndDragEnd?.({ active: { id: 'task-42' }, over: { id: `cell-${iso}` } });
    expect(onDropTask).toHaveBeenCalledWith('42', new Date(iso));
  });

  it('invokes onResizeEvent with updated time when resizing', () => {
    const onResizeEvent = vi.fn();
    const start = '2099-01-01T09:00:00.000Z';
    const end = '2099-01-01T10:00:00.000Z';
    render(
      <CalendarGrid
        view="day"
        events={[{ id: 'e1', taskId: 't1', startAt: start, endAt: end, title: 'Study' }]}
        onDropTask={() => {}}
        onResizeEvent={onResizeEvent}
      />
    );
    act(() => {
      const setter = transforms.get('event-resize-end-e1');
      setter?.({ x: 0, y: 48 });
    });
    monitors[0].onDragEnd({ active: { id: 'event-resize-end-e1' } });
    expect(onResizeEvent).toHaveBeenCalledWith('e1', 'end', new Date('2099-01-01T11:00:00.000Z'));
  });

  it('stacks overlapping events in DOM order', () => {
    const events = [
      { id: 'a', taskId: 't1', startAt: '2099-01-01T09:00:00.000Z', endAt: '2099-01-01T10:00:00.000Z', title: 'Event A' },
      { id: 'b', taskId: 't2', startAt: '2099-01-01T09:00:00.000Z', endAt: '2099-01-01T10:30:00.000Z', title: 'Event B' },
    ];
    render(<CalendarGrid view="day" events={events} onDropTask={() => {}} />);
    const aBox = screen.getByText('Event A');
    const bBox = screen.getByText('Event B');
    expect(aBox).toBeInTheDocument();
    expect(bBox).toBeInTheDocument();
    expect(aBox.compareDocumentPosition(bBox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
