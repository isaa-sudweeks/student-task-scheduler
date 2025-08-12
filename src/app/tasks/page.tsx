"use client";
import React,{useMemo,useState} from 'react';
import { api } from '@/server/api/react';

export default function TasksPage(){
  const [title,setTitle]=useState("");
  const [dueAtStr,setDueAtStr]=useState(""); // yyyy-MM-ddTHH:mm
  const [showDuePicker, setShowDuePicker] = useState(false);
  const utils=api.useUtils();
  const [filter, setFilter] = useState<'all'|'overdue'|'today'>('all');
  const list=api.task.list.useQuery({ filter });
  const create=api.task.create.useMutation({
    onSuccess:async()=>{
      setTitle("");
      setDueAtStr("");
      await utils.task.list.invalidate();
    },
    onError:(e)=>{
      alert(e.message || 'Failed to create task');
    }
  });
  const del=api.task.delete.useMutation({onSuccess:async()=>utils.task.list.invalidate()});
  const setDue=api.task.setDueDate.useMutation({
    onSuccess:async()=>utils.task.list.invalidate(),
    onError:(e)=>{
      alert(e.message || 'Failed to set due date');
    }
  });

  return(
    <main className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your Tasks</h1>
          <p className="text-sm opacity-75">Create and manage your tasks — no sign in required.</p>
        </div>
      </header>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e)=>{
          e.preventDefault();
          if(!title.trim())return;
          const dueAt = dueAtStr ? new Date(dueAtStr) : null;
          create.mutate({title, dueAt});
        }}
      >
        <input
          className="flex-1 rounded border px-3 py-2"
          placeholder="New task title…"
          value={title}
          onChange={(e)=>setTitle(e.target.value)}
        />
        {showDuePicker && (
          <input
            type="datetime-local"
            className="rounded border px-3 py-2 shrink-0"
            value={dueAtStr}
            onChange={(e)=>setDueAtStr(e.target.value)}
            aria-label="Due date"
          />
        )}
        <button
          type="button"
          className="rounded border px-4 py-2 shrink-0 bg-gray-100 text-gray-900 border-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700"
          onClick={()=>{
            // Default to end of today if empty
            if(!dueAtStr){
              const d = new Date();
              d.setHours(23,59,0,0);
              setDueAtStr(d.toISOString().slice(0,16));
            }
            setShowDuePicker((v)=>!v);
          }}
          aria-label="Toggle due date picker"
        >
          Set Due Date
        </button>
        <button className="rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black shrink-0" disabled={create.isPending}>Add</button>
      </form>
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
        {list.data?.map((t)=>{
          const overdue = t.dueAt ? new Date(t.dueAt) < new Date() : false;
          return (
            <li key={t.id} className={`flex items-center justify-between rounded border px-3 py-2 ${overdue? 'border-red-500 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200' : ''}`}>
              <div className="flex flex-col gap-1">
                <span className="font-medium">{t.title}</span>
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
              <button className="text-sm underline" onClick={()=>del.mutate({id:t.id})}>Delete</button>
            </li>
          );
        })}
        {list.isLoading&&<li>Loading…</li>}
        {!list.isLoading&&(list.data?.length??0)===0&&<li className="opacity-60">No tasks yet.</li>}
      </ul>
    </main>
  );
}
