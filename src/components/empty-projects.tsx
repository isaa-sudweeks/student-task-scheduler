"use client";
import React from "react";
import { Button } from "@/components/ui/button";

interface EmptyProjectsProps {
  onAdd: () => void;
}

export function EmptyProjects({ onAdd }: EmptyProjectsProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground">
      <span className="text-4xl">📁</span>
      <p className="text-sm">No projects yet.</p>
      <Button type="button" onClick={onAdd}>
        Add Project
      </Button>
    </div>
  );
}

export default EmptyProjects;
