import { vi, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
// Force a deterministic timezone for date logic tests
process.env.TZ = 'UTC';
process.env.DATABASE_URL ??= 'postgres://localhost:5432/test';
process.env.NEXTAUTH_SECRET ??= 'Aa1!'.repeat(8);
process.env.NEXTAUTH_URL ??= 'http://localhost:3000';
process.env.GITHUB_ID ??= 'test-github-id';
process.env.GITHUB_SECRET ??= 'test-github-secret';
process.env.GOOGLE_CLIENT_ID ??= 'test-google-id';
process.env.GOOGLE_CLIENT_SECRET ??= 'test-google-secret';
// Freeze time to a deterministic date so calendar/event tests render predictable weeks
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2099-01-01T00:00:00Z'));
});
// Ensure DOM is reset between tests to avoid state leakage
afterEach(() => {
  vi.clearAllTimers();
  cleanup();
});
import React from 'react';

// Mock Next.js app router hooks for client components during unit tests
vi.mock('next/navigation', () => {
  const push = vi.fn();
  const replace = vi.fn();
  const back = vi.fn();
  const forward = vi.fn();
  const refresh = vi.fn();
  const prefetch = vi.fn();
  return {
    useRouter: () => ({ push, replace, back, forward, refresh, prefetch }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(''),
    redirect: vi.fn(),
    notFound: vi.fn(),
  };
});

// Provide a safe default mock for tRPC React hooks; individual tests can override.
vi.mock('@/server/api/react', () => {
  const fn = () => ({ mutate: vi.fn(), isPending: false, error: undefined });
  return {
    api: {
      useUtils: () => ({
        task: { list: { invalidate: vi.fn() } },
        event: { listRange: { invalidate: vi.fn() } },
        focus: { status: { invalidate: vi.fn() } },
      }),
      task: {
        list: { useQuery: () => ({ data: [], isLoading: false, error: undefined }) },
        create: { useMutation: fn },
        update: { useMutation: fn },
        delete: { useMutation: fn },
        updateTitle: { useMutation: fn },
        setStatus: { useMutation: fn },
        setDueDate: { useMutation: fn },
        reorder: { useMutation: fn },
        bulkUpdate: { useMutation: fn },
        bulkDelete: { useMutation: fn },
      },
      user: {
        get: { useQuery: () => ({ data: null, isLoading: false, error: undefined }) },
        setTimezone: { useMutation: fn },
        // Return undefined so Settings page reads from localStorage in unit tests
        getSettings: { useQuery: () => ({ data: undefined, isLoading: false, error: undefined }) },
        setSettings: { useMutation: fn },
      },
      event: {
        listRange: { useQuery: () => ({ data: [], isLoading: false }) },
        schedule: { useMutation: fn },
        move: { useMutation: fn },
      },
      focus: {
        start: { useMutation: fn },
        stop: { useMutation: fn },
      },
    },
  } as any;
});

// Mock recharts to lightweight React stubs so charts don't require the library in unit tests
vi.mock('recharts', () => {
  const Div = (props: any) => React.createElement('div', props);
  const Null = () => null;
  return {
    BarChart: Div,
    Bar: Null,
    XAxis: Null,
    YAxis: Null,
    Tooltip: Null,
    Legend: Null,
    Label: Null,
    PieChart: Div,
    Pie: Null,
    Cell: Null,
    ResponsiveContainer: Div,
  } as any;
});

// Mock next-auth for components using session hooks in unit tests
vi.mock('next-auth/react', () => {
  return {
    useSession: () => ({ data: { user: { name: 'Test User', image: null } }, status: 'authenticated' }),
    signIn: vi.fn(),
    signOut: vi.fn(),
    SessionProvider: ({ children }: any) => children,
  } as any;
});
(HTMLElement.prototype as any).scrollIntoView = () => {};

// Mock fuse.js used in TaskList to avoid requiring the library in unit tests
vi.mock('fuse.js', () => {
  class FakeFuse<T> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_list?: T[], _options?: any) {}
    search() { return []; }
  }
  return { default: FakeFuse } as any;
});

// Mock Prisma enums to avoid requiring generated client in unit tests
vi.mock('@prisma/client', () => {
  return {
    TaskPriority: { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
    TaskStatus: { TODO: 'TODO', IN_PROGRESS: 'IN_PROGRESS', DONE: 'DONE', CANCELLED: 'CANCELLED' },
    RecurrenceType: { NONE: 'NONE', DAILY: 'DAILY', WEEKLY: 'WEEKLY', MONTHLY: 'MONTHLY' },
    Prisma: {},
  } as any;
});
