"use client";
import React from 'react';
import { useRouter } from 'next/navigation';

type ViewMode = 'day' | 'week' | 'month';

export function CalendarHeader(props: {
  changeDate: (delta: number) => void;
  baseDate: Date;
  view: ViewMode;
  setView: (v: ViewMode) => void;
}) {
  const { changeDate, baseDate, view, setView } = props;
  const router = useRouter();
  return (
    <header className="flex items-center justify-between gap-2 md:col-span-4">
      <div className="flex items-center gap-2">
        <a
          href="/"
          className="rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
          title="Back to Home"
          onClick={(e) => { e.preventDefault(); router.push('/'); }}
        >
          Home
        </a>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous"
            className="rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            onClick={() => changeDate(-1)}
          >
            Prev
          </button>
          <button
            type="button"
            className={`rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5 ${
              baseDate.toDateString() === new Date().toDateString()
                ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                : ''
            }`}
            onClick={() => changeDate(0)}
            aria-current={baseDate.toDateString() === new Date().toDateString() ? 'date' : undefined}
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Next"
            className="rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            onClick={() => changeDate(1)}
          >
            Next
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div role="tablist" aria-label="Calendar view" className="flex gap-2">
          {(['day', 'week', 'month'] as ViewMode[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              className={`px-3 py-1 text-sm border-b-2 ${view === v ? 'border-black dark:border-white' : 'border-transparent'}`}
              onClick={() => setView(v)}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
