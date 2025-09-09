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
  return {
    __esModule: true,
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

import { TimeGrid } from './TimeGrid';
import { DndContext } from '@dnd-kit/core';

describe('TimeGrid interactions', () => {
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
        <TimeGrid view="day" startOfWeek={new Date('2099-01-01T00:00:00Z')} events={[]} onDropTask={onDropTask} />
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
      <TimeGrid
        view="day"
        startOfWeek={new Date('2099-01-01T00:00:00Z')}
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
    render(
      <DndContext>
        <TimeGrid view="day" startOfWeek={new Date('2099-01-01T00:00:00Z')} events={events} onDropTask={() => {}} />
      </DndContext>
    );
    const aBox = screen.getByText('Event A');
    const bBox = screen.getByText('Event B');
    expect(aBox).toBeInTheDocument();
    expect(bBox).toBeInTheDocument();
    expect(aBox.compareDocumentPosition(bBox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('TimeGrid current time indicator', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders now line in day and week views', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2099-01-01T09:00:00Z'));
    render(<TimeGrid view="day" startOfWeek={new Date('2099-01-01T00:00:00Z')} events={[]} onDropTask={() => {}} />);
    expect(screen.getByTestId('now-indicator')).toBeInTheDocument();
    cleanup();
    render(<TimeGrid view="week" startOfWeek={new Date('2099-01-01T00:00:00Z')} events={[]} onDropTask={() => {}} />);
    expect(screen.getByTestId('now-indicator')).toBeInTheDocument();
  });

  it('updates position every minute', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2099-01-01T09:30:00Z'));
    render(<TimeGrid view="day" events={[]} onDropTask={() => {}} />);
    const line = screen.getByTestId('now-indicator') as HTMLElement;
    const firstTop = parseFloat(line.style.top);
    act(() => {
      vi.setSystemTime(new Date('2099-01-01T09:31:00Z'));
      vi.advanceTimersByTime(60_000);
    });
    const newTop = parseFloat(screen.getByTestId('now-indicator').style.top);
    expect(newTop).toBeGreaterThan(firstTop);
  });
});

describe('TimeGrid work hours + today highlight', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders full-day time labels and work hours highlight in day view', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2099-01-01T09:00:00Z'));
    render(
      <TimeGrid
        view="day"
        startOfWeek={new Date('2099-01-01T00:00:00Z')}
        events={[]}
        onDropTask={() => {}}
        workStartHour={6}
        workEndHour={20}
      />
    );
    expect(screen.getByText('12 AM')).toBeInTheDocument();
    expect(screen.getByText('11 PM')).toBeInTheDocument();
    expect(screen.getAllByTestId('work-hours-highlight')).toHaveLength(1);
  });

  it('renders work hours highlight for each day in week view and marks today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-15T09:00:00Z'));
    render(
      <TimeGrid
        view="week"
        startOfWeek={new Date('2024-05-13T00:00:00Z')}
        events={[]}
        onDropTask={() => {}}
        workStartHour={8}
        workEndHour={18}
      />
    );
    expect(screen.getAllByTestId('work-hours-highlight')).toHaveLength(7);
    expect(screen.getByTitle('Today')).toBeInTheDocument();
  });
});
