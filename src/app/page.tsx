"use client";
import React from "react";
import Link from "next/link";
import { TaskList } from "@/components/task-list";
import { NewTaskForm } from "@/components/new-task-form";
import ThemeToggle from "@/components/theme-toggle";
export default function HomePage() {
  return (
    <main className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your Tasks</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">No sign in required.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/calendar"
            className="rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            title="Open Calendar"
          >
            Calendar View
          </Link>
          <Link
            href="/stats"
            className="rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            title="Open Statistics"
          >
            Statistics
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <NewTaskForm />
      <TaskList />
    </main>
  );
}
