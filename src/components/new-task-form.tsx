"use client";
import React, { useState } from 'react';
import { api } from '@/server/api/react';
export function NewTaskForm(){const [title,setTitle]=useState("");const utils=api.useUtils();const create=api.task.create.useMutation({onSuccess:async()=>{setTitle("");await utils.task.list.invalidate();},});return(<form className="flex gap-2" onSubmit={(e)=>{e.preventDefault();if(!title.trim())return;create.mutate({title});}}><input className="flex-1 rounded border px-3 py-2" placeholder="Add a task…" value={title} onChange={(e)=>setTitle(e.target.value)} /><button className="rounded bg-black px-4 py-2 text-white disabled:opacity-60 dark:bg-white dark:text-black" disabled={create.isPending}>Add</button></form>);}
