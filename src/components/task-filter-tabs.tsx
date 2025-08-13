import React from 'react';

export type TaskFilter = 'all' | 'overdue' | 'today';

interface TaskFilterTabsProps {
  value: TaskFilter;
  onChange: (value: TaskFilter) => void;
}

export function TaskFilterTabs({ value, onChange }: TaskFilterTabsProps) {
  const options: { value: TaskFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'today', label: 'Today' },
  ];

  return (
    <div role="tablist" aria-label="Task filter" className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          type="button"
          aria-selected={value === opt.value}
          className={`rounded border px-3 py-1 text-sm ${
            value === opt.value
              ? 'bg-black text-white dark:bg-white dark:text-black'
              : 'bg-transparent'
          }`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default TaskFilterTabs;
