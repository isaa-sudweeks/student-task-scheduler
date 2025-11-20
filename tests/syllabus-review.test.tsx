import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SyllabusTaskReview } from '@/components/syllabus-task-review';

describe('SyllabusTaskReview', () => {
  it('allows students to toggle and edit suggested tasks before confirming', async () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);
    const handleCancel = vi.fn();

    render(
      <SyllabusTaskReview
        assignments={[
          {
            id: '1',
            title: 'Essay 1 Draft',
            dueAt: '2025-01-15T17:00:00.000Z',
            notes: 'Submit via LMS',
            include: true,
          },
          {
            id: '2',
            title: 'Lab Report 1',
            dueAt: '2025-02-03T17:00:00.000Z',
            include: true,
          },
        ]}
        courseTitle="Biology 101"
        isSaving={false}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /Lab Report 1/i }));
    fireEvent.change(screen.getByDisplayValue('Essay 1 Draft'), {
      target: { value: 'Essay 1 Final Draft' },
    });
    fireEvent.change(screen.getByLabelText(/Due date for Essay 1 Final Draft/i), {
      target: { value: '2025-01-20' },
    });

    fireEvent.click(screen.getByRole('button', { name: /add tasks/i }));

    await waitFor(() => {
      expect(handleConfirm).toHaveBeenCalledWith([
        {
          id: '1',
          title: 'Essay 1 Final Draft',
          dueAt: '2025-01-20T17:00:00.000Z',
          notes: 'Submit via LMS',
          include: true,
        },
        {
          id: '2',
          title: 'Lab Report 1',
          dueAt: '2025-02-03T17:00:00.000Z',
          include: false,
        },
      ]);
    });
  });
});
