// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
import { toast } from '@/lib/toast';
import CoursesPage from './page';

const { listMock, createMock, updateMock, deleteMock, deleteManyMock } = vi.hoisted(
  () => ({
    listMock: vi.fn(),
    createMock: vi.fn(),
    updateMock: vi.fn(),
    deleteMock: vi.fn(),
    deleteManyMock: vi.fn(),
  }),
);

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ course: { list: { invalidate: vi.fn() } } }),
    course: {
      list: { useQuery: listMock },
      create: { useMutation: createMock },
      update: { useMutation: updateMock },
      delete: { useMutation: deleteMock },
      deleteMany: { useMutation: deleteManyMock },
    },
  },
}));

describe('CoursesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteManyMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
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

  it('displays course count in heading', () => {
    listMock.mockReturnValue({
      data: [
        { id: '1', title: 'Math', term: null, color: null },
        { id: '2', title: 'History', term: null, color: null },
      ],
      isLoading: false,
      error: undefined,
    });
    createMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    render(<CoursesPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Courses (2)');
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
      data: [{ id: '1', title: 'Course', term: null, color: null, nextDueAt: null }],
      isLoading: false,
      error: undefined,
    });
    createMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    updateMock.mockReturnValue({ mutate: vi.fn(), isPending: true, error: { message: 'Update failed' } });
    deleteMock.mockReturnValue({ mutate: vi.fn(), isPending: true, error: { message: 'Delete failed' } });
    deleteManyMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    render(<CoursesPage />);
    const item = screen.getAllByRole('listitem')[0];
    expect(within(item).getByRole('button', { name: /save/i })).toBeDisabled();
    expect(within(item).getByRole('button', { name: /delete/i })).toBeDisabled();
    expect(screen.getByText('Update failed')).toBeInTheDocument();
    expect(screen.getByText('Delete failed')).toBeInTheDocument();
  });

  it('shows error toast when course title exists', () => {
    listMock.mockReturnValue({
      data: [{ id: '1', title: 'Math', term: null, color: null, nextDueAt: null }],
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
    const preview = screen.getByTestId('color-preview');
    expect(preview).toHaveStyle({ backgroundColor: '#000000' });
    const swatch = screen.getByRole('button', { name: 'Select color #FF0000' });
    fireEvent.click(swatch);
    expect(preview).toHaveStyle({ backgroundColor: '#FF0000' });
  });

  it('sorts courses by title by default and toggles to term', () => {
    const mockCourses = [
      { id: '1', title: 'B', term: 'Summer', color: null, nextDueAt: null },
      { id: '2', title: 'A', term: 'Winter', color: null, nextDueAt: null },
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

  it('toggles sort direction', () => {
    const mockCourses = [
      { id: '1', title: 'A', term: 'Fall', color: null, nextDueAt: null },
      { id: '2', title: 'B', term: 'Spring', color: null, nextDueAt: null },
    ];
    listMock.mockReturnValue({ data: mockCourses, isLoading: false, error: undefined });
    createMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    updateMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    deleteMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });

    render(<CoursesPage />);
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getAllByRole('textbox')[0]).toHaveValue('A');
    fireEvent.click(
      screen.getByRole('button', { name: /toggle sort direction/i }),
    );
    const itemsAfter = screen.getAllByRole('listitem');
    expect(within(itemsAfter[0]).getAllByRole('textbox')[0]).toHaveValue('B');
  });

  it('filters courses by search input', () => {
    vi.useFakeTimers();
    listMock.mockReturnValue({
      data: [
        { id: '1', title: 'Math', term: 'Fall', color: '#ABCDEF', nextDueAt: null },
        { id: '2', title: 'History', term: 'Spring', color: '#123456', nextDueAt: null },
      ],
      isLoading: false,
      error: undefined,
    });
    createMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    updateMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    deleteMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });

    render(<CoursesPage />);

    const input = screen.getByPlaceholderText('Search courses...');

    // filter by title (case insensitive)
    fireEvent.change(input, { target: { value: 'math' } });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByDisplayValue('Math')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('History')).toBeNull();

    // filter by term
    fireEvent.change(input, { target: { value: 'SPRING' } });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByDisplayValue('History')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Math')).toBeNull();

    // filter by color
    fireEvent.change(input, { target: { value: '#abcdef' } });
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
        { id: '1', title: 'Math', term: 'Fall', color: null, nextDueAt: null },
        { id: '2', title: 'History', term: 'Spring', color: null, nextDueAt: null },
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

  it('deletes selected courses', () => {
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
    const mutateMany = vi.fn();
    deleteManyMock.mockReturnValue({ mutate: mutateMany, isPending: false, error: undefined });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CoursesPage />);

    fireEvent.click(screen.getByLabelText('Select Math'));
    fireEvent.click(screen.getByRole('button', { name: /delete selected/i }));

    expect(mutateMany).toHaveBeenCalledWith({ ids: ['1'] });
  });

  it('shows message when no courses match search', () => {
    vi.useFakeTimers();
    listMock.mockReturnValue({
      data: [{ id: '1', title: 'Math', term: 'Fall', color: '#ABCDEF' }],
      isLoading: false,
      error: undefined,
    });
    createMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    updateMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    deleteMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });

    render(<CoursesPage />);

    const input = screen.getByPlaceholderText('Search courses...');
    fireEvent.change(input, { target: { value: 'History' } });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByText('No courses found')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('confirms before deleting a course', () => {
    listMock.mockReturnValue({
      data: [{ id: '1', title: 'Course', term: null, color: null }],
      isLoading: false,
      error: undefined,
    });
    createMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    updateMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: undefined });
    const mutate = vi.fn();
    deleteMock.mockReturnValue({ mutate, isPending: false, error: undefined });

    render(<CoursesPage />);

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }));
    expect(mutate).toHaveBeenCalledWith({ id: '1' });
  });
});
