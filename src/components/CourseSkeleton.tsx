'use client';
import React from 'react';

export function CourseSkeleton() {
  return (
    <li className="flex flex-col gap-2 rounded-md border p-4 animate-pulse">
      <div className="h-5 w-1/3 rounded bg-black/10 dark:bg-white/10" />
      <div className="h-4 w-1/4 rounded bg-black/10 dark:bg-white/10" />
    </li>
  );
}

