"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/server/api/react';
import { formatLocalDateTime, parseLocalDateTime } from '@/lib/datetime';
import { toast } from 'react-hot-toast';

export function NewTaskForm(){
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState("");
  const [dueAtStr, setDueAtStr] = useState(""); // yyyy-MM-ddTHH:mm
  const [showDuePicker, setShowDuePicker] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        formRef.current?.requestSubmit();
        return;
      }
      if (e.key === "Enter" && !e.ctrlKey) {
        const active = document.activeElement as HTMLElement | null;
        if (!active || active === document.body || (active.tagName !== "INPUT" && active.tagName !== "TEXTAREA")) {
          e.preventDefault();
          titleRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return(
    <>
    <form
      ref={formRef}
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
      <input
        ref={titleRef}
        className={`flex-1 rounded border px-3 py-2 ${titleError ? 'border-red-500' : ''}`}
        placeholder="Add a task…"
        value={title}
        aria-label="Task title"
        aria-invalid={titleError ? 'true' : undefined}
        onChange={(e)=>{
          setTitle(e.target.value);
          if (titleError && e.target.value.trim()) setTitleError("");
        }}
      />
      {showDuePicker && (
        <input
          type="datetime-local"
          className="rounded border px-3 py-2 shrink-0"
          value={dueAtStr}
          onChange={(e)=>setDueAtStr(e.target.value)}
          aria-label="Task due date"
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
