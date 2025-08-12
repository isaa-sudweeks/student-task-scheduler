"use client";
import React, { useState } from 'react';
import { api } from '@/server/api/react';

export function NewTaskForm(){
  const [title,setTitle]=useState("");
  const [dueAtStr,setDueAtStr]=useState(""); // yyyy-MM-ddTHH:mm
  const [showDuePicker, setShowDuePicker] = useState(false);
  const utils=api.useUtils();
  const create=api.task.create.useMutation({
    onSuccess:async()=>{
      setTitle("");
      setDueAtStr("");
      setShowDuePicker(false);
      await utils.task.list.invalidate();
    }
  });

  return(
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
        placeholder="Add a task…"
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
        />)
      }
      <button
        type="button"
        className="rounded border px-4 py-2 shrink-0 bg-gray-100 text-gray-900 border-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700"
        onClick={()=>{
          if(!dueAtStr){
            const d = new Date();
            d.setHours(23,59,0,0);
            setDueAtStr(d.toISOString().slice(0,16));
          }
          setShowDuePicker(v=>!v);
        }}
        aria-label="Toggle due date picker"
      >
        Set Due Date
      </button>
      <button className="rounded bg-black px-4 py-2 text-white disabled:opacity-60 dark:bg-white dark:text-black shrink-0" disabled={create.isPending}>Add</button>
      {create.error && (
        <p role="alert" className="w-full text-red-500">
          {create.error.message}
        </p>
      )}
    </form>
  );
}
