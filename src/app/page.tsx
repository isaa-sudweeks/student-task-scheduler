"use client";
import React from "react";
import { TaskList } from "@/components/task-list";
import { NewTaskForm } from "@/components/new-task-form";
export default function HomePage() {
  return (
    <main className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your Tasks</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">No sign in required.</p>
        </div>
      </header>
      <NewTaskForm />
      <TaskList />
    </main>
  );
}
