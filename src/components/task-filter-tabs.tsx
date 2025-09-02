import React from 'react';
import { useSession } from 'next-auth/react';
import { Tag, ChevronDown, Flag, BookOpen, Folder } from 'lucide-react';
import type { TaskPriority } from '@prisma/client';
import { api } from '@/server/api/react';

export type TaskFilter = 'all' | 'overdue' | 'today' | 'archive';

interface TaskFilterTabsProps {
  value: TaskFilter;
  onChange: (value: TaskFilter) => void;
  subject?: string | null;
  onSubjectChange?: (value: string | null) => void;
  priority?: TaskPriority | null;
  onPriorityChange?: (value: TaskPriority | null) => void;
  courseId?: string | null;
  onCourseChange?: (value: string | null) => void;
  projectId?: string | null;
  onProjectChange?: (value: string | null) => void;
}

export function TaskFilterTabs({
  value,
  onChange,
  subject,
  onSubjectChange,
  priority,
  onPriorityChange,
  courseId,
  onCourseChange,
  projectId,
  onProjectChange,
}: TaskFilterTabsProps) {
  const options: { value: TaskFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'today', label: 'Today' },
    { value: 'archive', label: 'Archive' },
  ];

  const { data: session } = useSession();
  const subjectsQuery = api.task.list.useQuery(
    { filter: 'all' },
    { enabled: !!session }
  );
  const { data: courses = [] } = api.course.list.useQuery({ page: 1, limit: 100 });
  const { data: projects = [] } = api.project.list.useQuery();
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
            className="appearance-none rounded-full border border-slate-200 bg-slate-100 py-1.5 pl-8 pr-8 text-sm text-slate-800 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
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
            className="appearance-none rounded-full border border-slate-200 bg-slate-100 py-1.5 pl-8 pr-8 text-sm text-slate-800 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
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
      {onCourseChange && (
        <div className="relative ml-2">
          <BookOpen className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <select
            aria-label="Course filter"
            title="Filter by course"
            className="appearance-none rounded-full border border-slate-200 bg-slate-100 py-1.5 pl-8 pr-8 text-sm text-slate-800 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
            value={courseId ?? ''}
            onChange={(e) => onCourseChange(e.target.value || null)}
          >
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </div>
      )}
      {onProjectChange && (
        <div className="relative ml-2">
          <Folder className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <select
            aria-label="Project filter"
            title="Filter by project"
            className="appearance-none rounded-full border border-slate-200 bg-slate-100 py-1.5 pl-8 pr-8 text-sm text-slate-800 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
            value={projectId ?? ''}
            onChange={(e) => onProjectChange(e.target.value || null)}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </div>
      )}
    </div>
  );
}

export default TaskFilterTabs;
