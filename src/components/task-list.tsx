"use client";
import React, { useState } from 'react';
import { api } from '@/server/api/react';
import { formatLocalDateTime, parseLocalDateTime } from '@/lib/datetime';
import { TaskListSkeleton } from './task-list-skeleton';

export function TaskList(){
  const [filter, setFilter] = useState<'all'|'overdue'|'today'>('all');
  const utils = api.useUtils();
  const tasks = api.task.list.useQuery({ filter });
  const setDue = api.task.setDueDate.useMutation({
    onSuccess: async () => utils.task.list.invalidate(),
  });
  const rename = api.task.updateTitle.useMutation({
    onSuccess: async () => utils.task.list.invalidate(),
    onError: (e) => alert(e.message || 'Failed to update title')
  });
  const del = api.task.delete.useMutation({
    onSuccess: async () => utils.task.list.invalidate(),
  });
  const setStatus = api.task.setStatus.useMutation({
    onSuccess: async () => utils.task.list.invalidate(),
    onError: (e) => alert(e.message || 'Failed to update status')
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
          const done = t.status === 'DONE';
          return (
            <li key={t.id} className={`flex items-center justify-between rounded border px-3 py-2 ${overdue? 'border-red-500 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200' : ''}`}>
              <div className="flex items-start gap-2 flex-1">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={done}
                  onChange={() => setStatus.mutate({ id: t.id, status: done ? 'TODO' : 'DONE' })}
                  aria-label={done ? 'Mark as todo' : 'Mark as done'}
                />
                <div className="flex flex-col gap-1 flex-1">
                  <input
                    type="text"
                    defaultValue={t.title}
                    className={`font-medium rounded border px-2 py-1 ${done ? 'line-through opacity-60' : ''}`}
                    onBlur={(e)=>rename.mutate({ id: t.id, title: e.currentTarget.value })}
                    onKeyDown={(e)=>{ if (e.key==='Enter') e.currentTarget.blur(); }}
                  />
                <div className="flex items-center gap-2 text-xs opacity-80">
                  <label>Due:</label>
                  <input
                    type="datetime-local"
                    className="rounded border px-2 py-1"
                    value={t.dueAt ? formatLocalDateTime(new Date(t.dueAt)) : ''}
                    onChange={(e)=>{
                      const v = e.target.value;
                      const date = v ? parseLocalDateTime(v) : null;
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
              </div>
              <button className="text-sm underline" onClick={()=>del.mutate({ id: t.id })}>Delete</button>
            </li>
          );
        })}
        {tasks.isLoading && <TaskListSkeleton />}
        {!tasks.isLoading && (tasks.data?.length ?? 0) === 0 && <li className="opacity-60">No tasks.</li>}
      </ul>
      {tasks.error && (
        <p role="alert" className="text-red-500">
          {tasks.error.message}
        </p>
      )}
      {setDue.error && (
        <p role="alert" className="text-red-500">
          {setDue.error.message}
        </p>
      )}
    </div>
  );
}
