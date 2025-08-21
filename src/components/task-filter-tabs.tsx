import React from 'react';
import { api } from '@/server/api/react';
import { Tag, ChevronDown, Flag } from 'lucide-react';
import type { TaskPriority } from '@prisma/client';

export type TaskFilter = 'all' | 'overdue' | 'today' | 'archive';

interface TaskFilterTabsProps {
  value: TaskFilter;
  onChange: (value: TaskFilter) => void;
  subject?: string | null;
  onSubjectChange?: (value: string | null) => void;
  priority?: TaskPriority | null;
  onPriorityChange?: (value: TaskPriority | null) => void;
}

export function TaskFilterTabs({
  value,
  onChange,
  subject,
  onSubjectChange,
  priority,
  onPriorityChange,
}: TaskFilterTabsProps) {
  const options: { value: TaskFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'today', label: 'Today' },
    { value: 'archive', label: 'Archive' },
  ];

  const subjectsQuery = api.task.list.useQuery({ filter: 'all' });
  const subjects = React.useMemo(() => {
    const set = new Set<string>();
    subjectsQuery.data?.forEach((t: any) => {
      if (t.subject) set.add(t.subject as string);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
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
        <div className="relative ml-2">
          <Tag className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <select
            aria-label="Subject filter"
            title="Filter by subject"
            className="appearance-none rounded-full border border-slate-200 bg-slate-100 py-1.5 pl-8 pr-8 text-sm text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400/50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
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
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </div>
      )}
      {onPriorityChange && (
        <div className="relative ml-2">
          <Flag className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <select
            aria-label="Priority filter"
            title="Filter by priority"
            className="appearance-none rounded-full border border-slate-200 bg-slate-100 py-1.5 pl-8 pr-8 text-sm text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400/50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
            value={priority ?? ''}
            onChange={(e) => onPriorityChange(e.target.value ? (e.target.value as TaskPriority) : null)}
          >
            <option value="">All priorities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </div>
      )}
    </div>
  );
}

export default TaskFilterTabs;
