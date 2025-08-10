"use client";
import React from "react";
import { TaskList } from "@/components/task-list";
import { NewTaskForm } from "@/components/new-task-form";
import { AuthButtons } from "@/components/auth-buttons";
export default function HomePage() {
  return (<main className="space-y-8"><header className="flex items-center justify-between"><div><h1 className="text-3xl font-bold">Student Task Scheduler</h1><p className="text-sm text-slate-600 dark:text-slate-300">Auth + tRPC + Prisma scaffold.</p></div><AuthButtons /></header><a className="inline-block rounded border px-3 py-2" href="/tasks">Go to Tasks →</a><NewTaskForm /><TaskList /></main>);
}
