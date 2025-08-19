import React from 'react';
import { api } from '@/server/api/react';

export type TaskFilter = 'all' | 'overdue' | 'today';

interface TaskFilterTabsProps {
  value: TaskFilter;
  onChange: (value: TaskFilter) => void;
  subject?: string | null;
  onSubjectChange?: (value: string | null) => void;
}

export function TaskFilterTabs({
  value,
  onChange,
  subject,
  onSubjectChange,
}: TaskFilterTabsProps) {
  const options: { value: TaskFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'today', label: 'Today' },
  ];

  const subjectsQuery = api.task.list.useQuery({ filter: 'all' });
  const subjects = React.useMemo(() => {
    const set = new Set<string>();
    subjectsQuery.data?.forEach((t: any) => {
      if (t.subject) set.add(t.subject as string);
    });
    return Array.from(set);
  }, [subjectsQuery.data]);

  return (
    <div role="tablist" aria-label="Task filter" className="flex gap-2 items-center">
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          type="button"
          aria-selected={value === opt.value}
          className={`bg-transparent px-3 py-1 text-sm border-b-2 transition ${
            value === opt.value
              ? 'border-black dark:border-white'
              : 'border-transparent'
          }`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
      {onSubjectChange && (
        <select
          aria-label="Subject filter"
          className="ml-2 bg-transparent px-2 py-1 text-sm border rounded"
          value={subject ?? ''}
          onChange={(e) => onSubjectChange(e.target.value || null)}
        >
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export default TaskFilterTabs;
