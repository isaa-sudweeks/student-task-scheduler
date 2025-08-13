"use client";

import React from "react";
import { NewTaskForm } from "@/components/new-task-form";
import { TaskList } from "@/components/task-list";

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
      </header>
      <NewTaskForm />
      <TaskList />
      <NewTaskForm />
      <TaskList />
    </main>
  );
}
