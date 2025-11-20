'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';

export interface ReviewAssignment {
  id: string;
  title: string;
  dueAt: string | null;
  notes?: string | null;
  include: boolean;
}

interface Props {
  assignments: ReviewAssignment[];
  courseTitle: string;
  isSaving: boolean;
  onConfirm(assignments: ReviewAssignment[]): Promise<void> | void;
  onCancel(): void;
}

const DEFAULT_TIME = '17:00';

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

const formatDate = (iso: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const formatTime = (iso: string | null) => {
  if (!iso) return DEFAULT_TIME;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return DEFAULT_TIME;
  return date.toISOString().slice(11, 16);
};

const mergeDateTime = (dateValue: string, timeValue: string) => {
  if (!dateValue) return null;
  const [year, month, day] = dateValue.split('-').map((value) => Number(value));
  const [hour, minute] = (timeValue || DEFAULT_TIME).split(':').map((value) => Number(value));
  if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) return null;
  return new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString();
};

export function SyllabusTaskReview({
  assignments,
  courseTitle,
  isSaving,
  onConfirm,
  onCancel,
}: Props) {
  const [items, setItems] = useState(assignments);

  useEffect(() => {
    setItems(assignments);
  }, [assignments]);

  const hasSelected = useMemo(() => items.some((item) => item.include), [items]);

  const updateItem = (id: string, update: Partial<ReviewAssignment>) => {
    setItems((current) =>
      current.map((assignment) => (assignment.id === id ? { ...assignment, ...update } : assignment)),
    );
  };

  const handleConfirm = async () => {
    await onConfirm(items);
  };

  return (
    <section className="rounded-xl border bg-white dark:bg-zinc-900 shadow-sm p-4 space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">Review syllabus assignments</h2>
        <p className="text-sm text-muted-foreground">
          Confirm the tasks we found for {courseTitle}. Uncheck any that you do not want to import.
        </p>
      </header>

      <div className="space-y-4">
        {items.map((assignment) => {
          const dateValue = formatDate(assignment.dueAt);
          const timeValue = formatTime(assignment.dueAt);

          return (
            <article
              key={assignment.id}
              className={cx(
                'rounded-lg border p-4 space-y-3',
                assignment.include ? 'border-indigo-300 dark:border-indigo-700' : 'opacity-70',
              )}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  aria-label={assignment.title}
                  checked={assignment.include}
                  onChange={(event) => updateItem(assignment.id, { include: event.target.checked })}
                />
                <div className="flex-1 space-y-2">
                  <Input
                    value={assignment.title}
                    onChange={(event) => updateItem(assignment.id, { title: event.target.value })}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      type="date"
                      aria-label={`Due date for ${assignment.title}`}
                      value={dateValue}
                      onChange={(event) =>
                        updateItem(assignment.id, {
                          dueAt: mergeDateTime(event.target.value, formatTime(assignment.dueAt)),
                        })
                      }
                    />
                    <Input
                      type="time"
                      aria-label={`Due time for ${assignment.title}`}
                      value={timeValue}
                      onChange={(event) =>
                        updateItem(assignment.id, {
                          dueAt: mergeDateTime(formatDate(assignment.dueAt), event.target.value || DEFAULT_TIME),
                        })
                      }
                    />
                  </div>
                  <Textarea
                    placeholder="Notes (optional)"
                    value={assignment.notes ?? ''}
                    onChange={(event) => updateItem(assignment.id, { notes: event.target.value })}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <footer className="flex flex-col sm:flex-row gap-2 justify-end">
        <Button variant="outline" type="button" onClick={onCancel} disabled={isSaving}>
          Dismiss suggestions
        </Button>
        <Button type="button" onClick={handleConfirm} disabled={!hasSelected || isSaving}>
          {isSaving ? 'Adding tasks…' : 'Add tasks'}
        </Button>
      </footer>
    </section>
  );
}
