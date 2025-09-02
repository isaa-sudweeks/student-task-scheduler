// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
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
      data: [
        { id: '1', status: 'TODO', subject: 'Math', title: 'Task 1' },
        { id: '2', status: 'DONE', subject: 'Science', title: 'Task 2' },
        { id: '3', status: 'DONE', subject: 'Math', title: 'Task 3' },
      ],
      isLoading: false,
    });
    focusUseQueryMock.mockReturnValue({
      data: [{ taskId: '2', durationMs: 120000 }],
      isLoading: false,
    });

    render(<StatsPage />);
    expect(screen.getByText('Total Tasks: 3')).toBeInTheDocument();
    expect(screen.getByText('Completion Rate: 67%')).toBeInTheDocument();
    expect(screen.getByText('TODO: 1')).toBeInTheDocument();
    expect(screen.getByText('DONE: 2')).toBeInTheDocument();
    expect(screen.getByText('Math: 2')).toBeInTheDocument();
    expect(screen.getByText('Science: 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2: 2m')).toBeInTheDocument();
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
    expect(screen.getByText('Task: 1m')).toBeInTheDocument();
    expect(screen.getByText('Task: 2m')).toBeInTheDocument();
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
    expect(screen.getByText('Failed to load stats')).toBeInTheDocument();
  });

  it('navigates to tasks filtered by status when a bar is clicked', () => {
    taskUseQueryMock.mockReturnValue({
      data: [
        { id: '1', status: 'DONE', subject: 'Math', title: 'Task 1' },
      ],
      isLoading: false,
    });
    focusUseQueryMock.mockReturnValue({ data: [], isLoading: false });

    render(<StatsPage />);
    const router = useRouter();
    expect(barHandlers.length).toBeGreaterThan(0);
    barHandlers[0]({ status: 'DONE' });
    expect(router.push).toHaveBeenCalledWith('/tasks?status=DONE');
  });

  it('navigates to tasks filtered by subject when a pie slice is clicked', () => {
    taskUseQueryMock.mockReturnValue({
      data: [
        { id: '1', status: 'TODO', subject: 'Math', title: 'Task 1' },
      ],
      isLoading: false,
    });
    focusUseQueryMock.mockReturnValue({ data: [], isLoading: false });

    render(<StatsPage />);
    const router = useRouter();
    expect(pieHandlers.length).toBeGreaterThan(0);
    pieHandlers[0]({ subject: 'Math' });
    expect(router.push).toHaveBeenCalledWith('/tasks?subject=Math');
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
