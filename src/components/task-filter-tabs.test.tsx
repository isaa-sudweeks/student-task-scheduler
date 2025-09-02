// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { TaskFilterTabs } from './task-filter-tabs';
import { TaskPriority } from '@prisma/client';

vi.mock('@/server/api/react', () => ({
  api: {
    task: {
      list: {
        useQuery: () => ({
          data: [
            { id: '1', subject: 'math' },
            { id: '2', subject: 'science' },
            { id: '3', subject: null },
          ],
          isLoading: false,
          error: undefined,
        }),
      },
    },
    course: { list: { useQuery: () => ({ data: [{ id: 'c1', title: 'Course 1', description: null }] }) } },
    project: { list: { useQuery: () => ({ data: [{ id: 'p1', title: 'Project 1' }] }) } },
  },
}));

expect.extend(matchers);

describe('TaskFilterTabs', () => {
  it('calls onChange with selected filter', () => {
    const handleChange = vi.fn();
    render(<TaskFilterTabs value="all" onChange={handleChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Overdue' }));
    expect(handleChange).toHaveBeenCalledWith('overdue');
  });

  it('renders subject options and calls onSubjectChange', () => {
    const handleSubject = vi.fn();
    render(
      <TaskFilterTabs
        value="all"
        onChange={() => {}}
        subject={null}
        onSubjectChange={handleSubject}
      />
    );
    const select = screen.getByLabelText('Subject filter');
    fireEvent.change(select, { target: { value: 'math' } });
    expect(handleSubject).toHaveBeenCalledWith('math');
    expect(screen.getByRole('option', { name: 'science' })).toBeInTheDocument();
  });

  it('renders priority options and calls onPriorityChange', () => {
    const handlePriority = vi.fn();
    render(
      <TaskFilterTabs
        value="all"
        onChange={() => {}}
        priority={null}
        onPriorityChange={handlePriority}
      />
    );
    const select = screen.getByLabelText('Priority filter');
    fireEvent.change(select, { target: { value: TaskPriority.HIGH } });
    expect(handlePriority).toHaveBeenCalledWith(TaskPriority.HIGH);
  });

  it('renders course options and calls onCourseChange', () => {
    const handleCourse = vi.fn();
    render(
      <TaskFilterTabs
        value="all"
        onChange={() => {}}
        courseId={null}
        onCourseChange={handleCourse}
      />
    );
    const select = screen.getByLabelText('Course filter');
    fireEvent.change(select, { target: { value: 'c1' } });
    expect(handleCourse).toHaveBeenCalledWith('c1');
    expect(screen.getByRole('option', { name: 'Course 1' })).toBeInTheDocument();
  });

  it('renders project options and calls onProjectChange', () => {
    const handleProject = vi.fn();
    render(
      <TaskFilterTabs
        value="all"
        onChange={() => {}}
        projectId={null}
        onProjectChange={handleProject}
      />
    );
    const select = screen.getByLabelText('Project filter');
    fireEvent.change(select, { target: { value: 'p1' } });
    expect(handleProject).toHaveBeenCalledWith('p1');
    expect(screen.getByRole('option', { name: 'Project 1' })).toBeInTheDocument();
  });
});
