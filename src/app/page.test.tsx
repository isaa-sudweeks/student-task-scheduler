// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import HomePage from './page';
import NavBar from '@/components/nav-bar';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Test User', image: '' } } }),
  signOut: () => {},
}));

let mockSearch = '';
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

const useInfiniteQueryMock = vi.fn().mockReturnValue({
  data: { pages: [[]] },
  isLoading: false,
  error: undefined,
  fetchNextPage: () => {},
  hasNextPage: false,
  isFetchingNextPage: false,
});

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ task: { list: { invalidate: () => {} } } }),
    task: {
      list: {
        useInfiniteQuery: (...args: any[]) => useInfiniteQueryMock(...args),
        useQuery: () => ({ data: [], isLoading: false, error: undefined }),
      },
      create: { useMutation: () => ({ mutate: () => {}, isPending: false, error: undefined }) },
      update: { useMutation: () => ({ mutate: () => {}, isPending: false, error: undefined }) },
      setDueDate: { useMutation: () => ({ mutate: () => {}, isPending: false, error: undefined }) },
      delete: { useMutation: () => ({ mutate: () => {}, isPending: false, error: undefined }) },
      setStatus: { useMutation: () => ({ mutate: () => {}, isPending: false, error: undefined }) },
      reorder: { useMutation: () => ({ mutate: () => {}, isPending: false, error: undefined }) },
      bulkUpdate: { useMutation: () => ({ mutate: () => {}, isPending: false, error: undefined }) },
      bulkDelete: { useMutation: () => ({ mutate: () => {}, isPending: false, error: undefined }) },
    },
    project: { list: { useQuery: () => ({ data: [] }) } },
    course: { list: { useQuery: () => ({ data: [] }) } },
    user: { get: { useQuery: () => ({ data: null, isLoading: false, error: undefined }) } },
  },
}));

describe('HomePage', () => {
  afterEach(() => {
    mockSearch = '';
    useInfiniteQueryMock.mockClear();
  });
  it('renders header with count, filters, search and new task button', () => {
    render(
      <>
        <NavBar />
        <HomePage />
      </>
    );
    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeInTheDocument();
    expect(screen.getByText('· 0')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search tasks...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new task/i })).toBeInTheDocument();
    ['All', 'Today', 'Overdue'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
  });

  it('renders account menu button', () => {
    render(
      <>
        <NavBar />
        <HomePage />
      </>
    );
    expect(
      screen.getByRole('button', { name: /account menu/i })
    ).toBeInTheDocument();
  });

  it('focuses search on "/" key', () => {
    render(
      <>
        <NavBar />
        <HomePage />
      </>
    );
    const input = screen.getByPlaceholderText('Search tasks...') as HTMLInputElement;
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(window, { key: '/' });
    expect(document.activeElement).toBe(input);
  });

  it('cycles filter with ctrl+arrow keys', () => {
    render(
      <>
        <NavBar />
        <HomePage />
      </>
    );
    // Tabs are buttons styled as tabs; verify cycling changes selected label
    expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true });
    expect(screen.getByRole('button', { name: /overdue/i })).toBeInTheDocument();
  });

  it('shows shortcuts popover when clicking question mark', () => {
    render(
      <>
        <NavBar />
        <HomePage />
      </>
    );
    const btn = screen.getByRole('button', { name: /show shortcuts/i });
    fireEvent.click(btn);
    expect(screen.getByText('Create task')).toBeInTheDocument();
  });

  it('passes search params to task query', () => {
    mockSearch = 'status=DONE&subject=Math';
    render(
      <>
        <NavBar />
        <HomePage />
      </>
    );
    const args = useInfiniteQueryMock.mock.calls[0][0];
    expect(args).toMatchObject({
      filter: 'all',
      status: 'DONE',
      subject: 'Math',
    });
  });
});
