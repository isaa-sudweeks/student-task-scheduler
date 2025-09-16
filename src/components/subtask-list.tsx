"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SubtaskListProps {
  subtasks: { id: string; title: string }[];
  subtaskTitle: string;
  onSubtaskTitleChange: (value: string) => void;
  onAdd: () => void;
  disabled: boolean;
}

export function SubtaskList({
  subtasks,
  subtaskTitle,
  onSubtaskTitleChange,
  onAdd,
  disabled,
}: SubtaskListProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Subtasks</h3>
      <ul className="ml-6 list-disc">
        {subtasks.map((st) => (
          <li key={st.id}>{st.title}</li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Input
          placeholder="New subtask"
          value={subtaskTitle}
          onChange={(e) => onSubtaskTitleChange(e.target.value)}
        />
        <Button type="button" onClick={onAdd} disabled={!subtaskTitle.trim() || disabled}>
          Add subtask
        </Button>
      </div>
    </div>
  );
}

export default SubtaskList;
