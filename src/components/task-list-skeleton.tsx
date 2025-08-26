'use client';
import React from 'react';

export function TaskListSkeleton() {
  const widths = ['100%', '95%', '90%', '85%', '92%'];
  return (
    <ul className="space-y-2 p-2" aria-label="Loading tasks">
      {widths.slice(0, 4).map((w, i) => (
        <li
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className="h-10 rounded-md border bg-neutral-200 dark:bg-neutral-700 animate-pulse"
          style={{ width: w }}
        />
      ))}
    </ul>
  );
}
