"use client";
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/server/api/react';
import { formatLocalDateTime, parseLocalDateTime } from '@/lib/datetime';
import { toast } from 'react-hot-toast';
import { Calendar } from 'lucide-react';

export function NewTaskForm(){
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState("");
  const [dueAtStr, setDueAtStr] = useState(""); // yyyy-MM-ddTHH:mm
  const [showDuePicker, setShowDuePicker] = useState(false);
  const utils=api.useUtils();
  const create=api.task.create.useMutation({
    onSuccess:async()=>{
      setTitle("");
      setDueAtStr("");
      setShowDuePicker(false);
      setTitleError("");
      await utils.task.list.invalidate();
    },
    onError:(e)=>{
      toast.error(e.message || 'Failed to create task');
    }
  });

  return(
    <>
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e)=>{
        e.preventDefault();
        if (!title.trim()) {
          setTitleError("Title is required");
          return;
        }
        setTitleError("");
        const dueAt = dueAtStr ? parseLocalDateTime(dueAtStr) : null;
        create.mutate({title, dueAt});
      }}
    >
      <div className="relative flex-1">
        <input
          className={`w-full rounded border pl-3 pr-8 py-2 ${titleError ? 'border-red-500' : ''}`}
          placeholder="Add a task…"
          value={title}
          aria-label="Task title"
          aria-invalid={titleError ? 'true' : undefined}
          onChange={(e)=>{
            setTitle(e.target.value);
            if (titleError && e.target.value.trim()) setTitleError("");
          }}
        />
        <button
          type="button"
          aria-label="Toggle due date picker"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
          onClick={()=>{
            if(!dueAtStr){
              const d = new Date();
              d.setHours(23,59,0,0);
              setDueAtStr(formatLocalDateTime(d));
            }
            setShowDuePicker(v=>!v);
          }}
        >
          <Calendar className="h-4 w-4" />
        </button>
      </div>
      {showDuePicker && (
        <input
          type="datetime-local"
          className="rounded border px-3 py-2 shrink-0"
          value={dueAtStr}
          onChange={(e)=>setDueAtStr(e.target.value)}
          aria-label="Task due date"
        />)
      }
      
      <Button type="submit" className="shrink-0" disabled={create.isPending}>Add</Button>
      {titleError && (
        <p role="alert" className="w-full text-red-500">
          {titleError}
        </p>
      )}
    </form>
    {create.error && (
      <p role="alert" className="text-red-500">{create.error.message}</p>
    )}
    </>
  );
}
