"use client";
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/server/api/react';
import { formatLocalDateTime, parseLocalDateTime } from '@/lib/datetime';
import { toast } from 'react-hot-toast';

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
    },
    onError:(e)=>{
      toast.error(e.message || 'Failed to create task');
    }
  });

  return(
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e)=>{
        e.preventDefault();
        if(!title.trim())return;
        const dueAt = dueAtStr ? parseLocalDateTime(dueAtStr) : null;
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
      <Button
        type="button"
        variant="secondary"
        className="shrink-0"
        onClick={()=>{
          if(!dueAtStr){
            const d = new Date();
            d.setHours(23,59,0,0);
            setDueAtStr(formatLocalDateTime(d));
          }
          setShowDuePicker(v=>!v);
        }}
        aria-label="Toggle due date picker"
      >
        Set Due Date
      </Button>
      <Button type="submit" className="shrink-0" disabled={create.isPending}>Add</Button>
    </form>
  );
}
