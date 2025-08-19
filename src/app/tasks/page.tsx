"use client";

import React from "react";
import { NewTaskForm } from "@/components/new-task-form";
import { TaskList } from "@/components/task-list";
import ThemeToggle from "@/components/theme-toggle";
import Link from "next/link";

export default function TasksPage() {
  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your Tasks</h1>
          <p className="text-sm opacity-75">
            Create and manage your tasks — no sign in required.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/calendar"
            className="rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            title="Open Calendar"
          >
            Calendar View
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <NewTaskForm />
      <TaskList />
    </main>
  );
}
