// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import HomePage from './page';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Test User', image: '' } } }),
  signOut: () => {},
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ task: { list: { invalidate: () => {} } } }),
    task: {
      list: {
        useInfiniteQuery: () => ({
          data: { pages: [[]] },
          isLoading: false,
          error: undefined,
          fetchNextPage: () => {},
          hasNextPage: false,
          isFetchingNextPage: false,
        }),
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
  it('renders header with count, filters, search and new task button', () => {
    render(<HomePage />);
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('· 0')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search tasks...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new task/i })).toBeInTheDocument();
    ['All', 'Today', 'Overdue'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
  });

  it('shows account menu with Settings and opens dropdown', () => {
    render(<HomePage />);
    const acctBtn = screen.getByRole('button', { name: /settings/i });
    expect(acctBtn).toBeInTheDocument();
    // open menu
    acctBtn.click();
    expect(screen.getByRole('menuitem', { name: /account settings/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument();
  });

  it('focuses search on "/" key', () => {
    render(<HomePage />);
    const input = screen.getByPlaceholderText('Search tasks...') as HTMLInputElement;
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(window, { key: '/' });
    expect(document.activeElement).toBe(input);
  });

  it('cycles filter with ctrl+arrow keys', () => {
    render(<HomePage />);
    const allTab = screen.getByRole('tab', { name: /all/i });
    expect(allTab).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true });
    const overdueTab = screen.getByRole('tab', { name: /overdue/i });
    expect(overdueTab).toHaveAttribute('aria-selected', 'true');
  });

  it('shows shortcuts popover when clicking question mark', () => {
    render(<HomePage />);
    const btn = screen.getByRole('button', { name: /show shortcuts/i });
    fireEvent.click(btn);
    expect(screen.getByText('Create task')).toBeInTheDocument();
  });
});
