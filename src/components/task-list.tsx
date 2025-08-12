"use client";
import React, { useState } from 'react';
import { api } from '@/server/api/react';

export function TaskList(){
  const [filter, setFilter] = useState<'all'|'overdue'|'today'>('all');
  const utils = api.useUtils();
  const tasks = api.task.list.useQuery({ filter });
  const setDue = api.task.setDueDate.useMutation({
    onSuccess: async () => utils.task.list.invalidate(),
    onError: (e) => alert(e.message || 'Failed to set due date')
  });
  const rename = api.task.updateTitle.useMutation({
    onSuccess: async () => utils.task.list.invalidate(),
    onError: (e) => alert(e.message || 'Failed to update title')
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-sm opacity-80">Filter:</label>
        <select
          className="rounded border px-2 py-1"
          value={filter}
          onChange={(e)=>setFilter(e.target.value as any)}
        >
          <option value="all">All</option>
          <option value="overdue">Overdue</option>
          <option value="today">Today</option>
        </select>
      </div>
      <ul className="space-y-2">
        {tasks.data?.map((t)=>{
          const overdue = t.dueAt ? new Date(t.dueAt) < new Date() : false;
          return (
            <li key={t.id} className={`flex items-center justify-between rounded border px-3 py-2 ${overdue? 'border-red-500 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200' : ''}`}>
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  defaultValue={t.title}
                  className="font-medium rounded border px-2 py-1"
                  onBlur={(e)=>rename.mutate({ id: t.id, title: e.currentTarget.value })}
                  onKeyDown={(e)=>{ if (e.key==='Enter') e.currentTarget.blur(); }}
                />
                <div className="flex items-center gap-2 text-xs opacity-80">
                  <label>Due:</label>
                  <input
                    type="datetime-local"
                    className="rounded border px-2 py-1"
                    value={t.dueAt ? new Date(t.dueAt).toISOString().slice(0,16) : ''}
                    onChange={(e)=>{
                      const v = e.target.value;
                      const date = v ? new Date(v) : null;
                      setDue.mutate({ id: t.id, dueAt: date });
                    }}
                  />
                  {t.dueAt && (
                    <button className="underline" onClick={()=>setDue.mutate({ id: t.id, dueAt: null })}>Clear</button>
                  )}
                  {t.dueAt && (
                    <span className="ml-2">{overdue ? 'Overdue' : `Due ${new Date(t.dueAt).toLocaleString()}`}</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
        {tasks.isLoading && <li>Loading…</li>}
        {!tasks.isLoading && (tasks.data?.length ?? 0) === 0 && <li className="opacity-60">No tasks.</li>}
      </ul>
    </div>
  );
}
