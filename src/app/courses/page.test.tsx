// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
import { toast } from '@/lib/toast';
import CoursesPage from './page';

const { listMock, createMock, updateMock, deleteMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ course: { list: { invalidate: vi.fn() } } }),
    course: {
      list: { useQuery: listMock },
      create: { useMutation: createMock },
      update: { useMutation: updateMock },
      delete: { useMutation: deleteMock },
    },
  },
}));

describe('CoursesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    listMock.mockReturnValue({ data: [], isLoading: true, error: undefined });
    createMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    render(<CoursesPage />);
    const list = screen.getByLabelText('Loading courses');
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
  });

  it('shows error message', () => {
    listMock.mockReturnValue({ data: [], isLoading: false, error: { message: 'Failed' } });
    createMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    render(<CoursesPage />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('disables add button and shows create error', () => {
    listMock.mockReturnValue({ data: [], isLoading: false, error: undefined });
    createMock.mockReturnValue({ mutate: vi.fn(), isPending: true, error: { message: 'Create failed' } });
    render(<CoursesPage />);
    expect(screen.getByRole('button', { name: /add course/i })).toBeDisabled();
    expect(screen.getByText('Create failed')).toBeInTheDocument();
  });

  it('disables save and delete buttons and shows errors', () => {
    listMock.mockReturnValue({
      data: [{ id: '1', title: 'Course', term: null, color: null }],
      isLoading: false,
      error: undefined,
    });
    createMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    updateMock.mockReturnValue({ mutate: vi.fn(), isPending: true, error: { message: 'Update failed' } });
    deleteMock.mockReturnValue({ mutate: vi.fn(), isPending: true, error: { message: 'Delete failed' } });
    render(<CoursesPage />);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled();
    expect(screen.getByText('Update failed')).toBeInTheDocument();
    expect(screen.getByText('Delete failed')).toBeInTheDocument();
  });

  it('shows error toast when course title exists', () => {
    listMock.mockReturnValue({
      data: [{ id: '1', title: 'Math', term: null, color: null }],
      isLoading: false,
      error: undefined,
    });
    const mutate = vi.fn();
    createMock.mockReturnValue({ mutate, isPending: false, error: undefined });
    render(<CoursesPage />);
    fireEvent.change(screen.getByPlaceholderText('Course title'), {
      target: { value: 'Math' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add course/i }));
    expect(mutate).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Course already exists.');
  });

  it('shows swatch preview when color changes', () => {
    listMock.mockReturnValue({ data: [], isLoading: false, error: undefined });
    createMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    render(<CoursesPage />);
    const input = screen.getByLabelText('Course color') as HTMLInputElement;
    const swatch = screen.getByTestId('color-preview');
    expect(swatch).toHaveStyle({ backgroundColor: '#000000' });
    fireEvent.change(input, { target: { value: '#123456' } });
    expect(swatch).toHaveStyle({ backgroundColor: '#123456' });
  });

  it('sorts courses by title by default and toggles to term', () => {
    const mockCourses = [
      { id: '1', title: 'B', term: 'Summer', color: null },
      { id: '2', title: 'A', term: 'Winter', color: null },
    ];
    listMock.mockReturnValue({ data: mockCourses, isLoading: false, error: undefined });
    createMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    updateMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    deleteMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });

    render(<CoursesPage />);
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getAllByRole('textbox')[0]).toHaveValue('A');
    fireEvent.click(screen.getByRole('button', { name: /sort by term/i }));
    const itemsAfter = screen.getAllByRole('listitem');
    expect(within(itemsAfter[0]).getAllByRole('textbox')[0]).toHaveValue('B');
  });

  it('filters courses by search input', () => {
    vi.useFakeTimers();
    listMock.mockReturnValue({
      data: [
        { id: '1', title: 'Math', term: null, color: null },
        { id: '2', title: 'History', term: null, color: null },
      ],
      isLoading: false,
      error: undefined,
    });
    createMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    updateMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    deleteMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });

    render(<CoursesPage />);

    expect(screen.getByDisplayValue('Math')).toBeInTheDocument();
    expect(screen.getByDisplayValue('History')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Search courses...');
    fireEvent.change(input, { target: { value: 'math' } });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByDisplayValue('Math')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('History')).toBeNull();
    vi.useRealTimers();
  });

  it('filters courses by selected term', () => {
    listMock.mockReturnValue({
      data: [
        { id: '1', title: 'Math', term: 'Fall', color: null },
        { id: '2', title: 'History', term: 'Spring', color: null },
      ],
      isLoading: false,
      error: undefined,
    });
    createMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    updateMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    deleteMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });

    render(<CoursesPage />);

    const select = screen.getByLabelText('Filter by term');
    fireEvent.change(select, { target: { value: 'Spring' } });

    expect(screen.getByDisplayValue('History')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Math')).toBeNull();
  });
});
