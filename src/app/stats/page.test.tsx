// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

const barHandlers: Array<(payload: any) => void> = [];
const pieHandlers: Array<(payload: any) => void> = [];
vi.mock('recharts', () => {
  const Div = (props: any) => React.createElement('div', props);
  const Null = () => null;
  const Bar = (props: any) => {
    if (props.onClick) barHandlers.push(props.onClick);
    return null;
  };
  const Pie = (props: any) => {
    if (props.onClick) pieHandlers.push(props.onClick);
    return null;
  };
  const Cell = () => null;
  return {
    BarChart: Div,
    Bar,
    XAxis: Null,
    YAxis: Null,
    Tooltip: Null,
    PieChart: Div,
    Pie,
    Cell,
    ResponsiveContainer: Div,
  } as any;
});

vi.mock('@/server/api/react', () => ({
  api: {
    task: {
      list: {
        useQuery: vi.fn(),
      },
    },
    focus: {
      aggregate: {
        useQuery: vi.fn(),
      },
    },
    course: {
      list: {
        useQuery: vi.fn(() => ({ data: [] })),
      },
    },
    project: {
      list: {
        useQuery: vi.fn(() => ({ data: [] })),
      },
    },
    user: {
      get: {
        useQuery: vi.fn(() => ({ data: {} })),
      },
    },
  },
}));

let mockTheme = 'light';
vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: mockTheme }),
}));

import { api } from '@/server/api/react';
import { useRouter } from 'next/navigation';
import StatsPage from './page';
import { ErrorBoundary } from '@/components/error-boundary';

const taskUseQueryMock = api.task.list.useQuery as ReturnType<typeof vi.fn>;
const focusUseQueryMock = api.focus.aggregate.useQuery as ReturnType<typeof vi.fn>;

expect.extend(matchers);

const sampleTasks = [
  { id: '1', status: 'TODO', subject: 'Math', title: 'Task 1' },
  { id: '2', status: 'DONE', subject: 'Science', title: 'Task 2' },
  { id: '3', status: 'DONE', subject: 'Math', title: 'Task 3' },
];

beforeAll(() => {
  class ResizeObserver {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe() {
      this.callback(
        [
          {
            contentRect: { width: 800, height: 400 },
          } as unknown as ResizeObserverEntry,
        ],
        this
      );
    }
    unobserve() {}
    disconnect() {}
  }
  (global as any).ResizeObserver = ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockTheme = 'light';
  barHandlers.length = 0;
  pieHandlers.length = 0;
});

describe('StatsPage', () => {
  it('renders summary metrics', () => {
    taskUseQueryMock.mockReturnValue({
      data: sampleTasks,
      isLoading: false,
    });
    focusUseQueryMock.mockReturnValue({
      data: [{ taskId: '2', durationMs: 120000 }],
      isLoading: false,
    });

    render(<StatsPage />);
    const range = taskUseQueryMock.mock.calls[0][0];
    expect(range.start).toBeInstanceOf(Date);
    expect(range.end).toBeInstanceOf(Date);
    expect(focusUseQueryMock.mock.calls[0][0]).toBe(range);

    const totalCardLabel = screen.getByText('Total Tasks');
    const totalCard = totalCardLabel.parentElement?.parentElement as HTMLElement;
    expect(totalCard).toBeInTheDocument();
    expect(within(totalCard).getByText('3')).toBeInTheDocument();
    expect(totalCard.querySelector('svg')).toBeTruthy();

    const rateCardLabel = screen.getByText('Completion Rate');
    const rateCard = rateCardLabel.parentElement?.parentElement as HTMLElement;
    expect(rateCard).toBeInTheDocument();
    expect(within(rateCard).getByText('67%')).toBeInTheDocument();
    expect(rateCard.querySelector('svg')).toBeTruthy();

    const avgFocusLabel = screen.getByText('Avg Focus (m)');
    const avgFocusCard = avgFocusLabel.parentElement?.parentElement as HTMLElement;
    expect(avgFocusCard).toBeInTheDocument();
    expect(within(avgFocusCard).getByText('2')).toBeInTheDocument();
    expect(avgFocusCard.querySelector('svg')).toBeTruthy();
    expect(screen.getByText('TODO: 1')).toBeInTheDocument();
    expect(screen.getByText('DONE: 2')).toBeInTheDocument();
    expect(screen.getByText('Math: 2')).toBeInTheDocument();
    expect(screen.getByText('Science: 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2: 2m')).toBeInTheDocument();
    expect(screen.getByText('Science: 2m')).toBeInTheDocument();
  });

  it('renders focus stats for tasks with duplicate titles without key warnings', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    taskUseQueryMock.mockReturnValue({
      data: [
        { id: '1', status: 'TODO', subject: 'Math', title: 'Task' },
        { id: '2', status: 'DONE', subject: 'Science', title: 'Task' },
      ],
      isLoading: false,
    });
    focusUseQueryMock.mockReturnValue({
      data: [
        { taskId: '1', durationMs: 60000 },
        { taskId: '2', durationMs: 120000 },
      ],
      isLoading: false,
    });

    render(<StatsPage />);
    const range = taskUseQueryMock.mock.calls[0][0];
    expect(range.start).toBeInstanceOf(Date);
    expect(range.end).toBeInstanceOf(Date);
    expect(focusUseQueryMock.mock.calls[0][0]).toBe(range);
    expect(screen.getByText('Task: 1m')).toBeInTheDocument();
    expect(screen.getByText('Task: 2m')).toBeInTheDocument();
    expect(screen.getByText('Math: 1m')).toBeInTheDocument();
    expect(screen.getByText('Science: 2m')).toBeInTheDocument();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('renders fallback when query fails', () => {
    taskUseQueryMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error('oops'),
    });
    focusUseQueryMock.mockReturnValue({ data: [], isLoading: false });

    render(
      <ErrorBoundary fallback={<main>Failed to load stats</main>}>
        <StatsPage />
      </ErrorBoundary>
    );
    const range = taskUseQueryMock.mock.calls[0][0];
    expect(range.start).toBeInstanceOf(Date);
    expect(range.end).toBeInstanceOf(Date);
    expect(focusUseQueryMock.mock.calls[0][0]).toBe(range);
    expect(screen.getByText('Failed to load stats')).toBeInTheDocument();
  });

  it('filters tasks by subject', () => {
    taskUseQueryMock.mockImplementation((input) => ({
      data:
        input?.subject === 'Math'
          ? sampleTasks.filter((t) => t.subject === 'Math')
          : sampleTasks,
      isLoading: false,
    }));
    focusUseQueryMock.mockReturnValue({ data: [], isLoading: false });

    render(<StatsPage />);
    fireEvent.change(screen.getByLabelText('Subject filter'), {
      target: { value: 'Math' },
    });
    expect(screen.getByText('Total Tasks: 2')).toBeInTheDocument();
    expect(screen.getByText('Math: 2')).toBeInTheDocument();
    expect(screen.queryByText('Science: 1')).not.toBeInTheDocument();
  });

  it('filters tasks by status', () => {
    taskUseQueryMock.mockImplementation((input) => ({
      data:
        input?.filter === 'archive'
          ? sampleTasks.filter((t) => t.status === 'DONE')
          : sampleTasks,
      isLoading: false,
    }));
    focusUseQueryMock.mockReturnValue({ data: [], isLoading: false });

    render(<StatsPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Archive' }));
    expect(screen.getByText('Total Tasks: 2')).toBeInTheDocument();
    expect(screen.getByText('Completion Rate: 100%')).toBeInTheDocument();
    expect(screen.queryByText('TODO: 1')).not.toBeInTheDocument();
    expect(screen.getByText('DONE: 2')).toBeInTheDocument();
  });

  describe('visual regression', () => {
    const tasks = [
      { id: '1', status: 'TODO', subject: 'Math', title: 'Task 1' },
      { id: '2', status: 'DONE', subject: 'Science', title: 'Task 2' },
    ];

    beforeEach(() => {
      taskUseQueryMock.mockReturnValue({
        data: tasks,
        isLoading: false,
      });
      focusUseQueryMock.mockReturnValue({
        data: [
          { taskId: '1', durationMs: 60000 },
          { taskId: '2', durationMs: 120000 },
        ],
        isLoading: false,
      });
    });

    it('matches light theme snapshot', () => {
      mockTheme = 'light';
      const { container } = render(<StatsPage />);
      expect(container).toMatchSnapshot();
    });

    it('matches dark theme snapshot', () => {
      mockTheme = 'dark';
      const { container } = render(<StatsPage />);
      expect(container).toMatchSnapshot();
    });
  });
});
