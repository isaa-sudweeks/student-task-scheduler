"use client";
import React from 'react';
import { api } from '@/server/api/react';
export function TaskList(){const tasks=api.task.list.useQuery();return(<ul className="space-y-2">{tasks.data?.map((t)=>(<li key={t.id} className="flex items-center justify-between rounded border px-3 py-2"><span>{t.title}</span></li>))}{tasks.isLoading && <li>Loading…</li>}</ul>);}
