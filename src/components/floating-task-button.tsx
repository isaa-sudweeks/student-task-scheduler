"use client";
import React, { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskModal } from "@/components/task-modal";
import { usePathname } from "next/navigation";

interface FloatingTaskButtonProps {
  hiddenPaths?: string[];
}

export function FloatingTaskButton({ hiddenPaths = [] }: FloatingTaskButtonProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const shouldHide = hiddenPaths.some((p) => pathname.startsWith(p));

  if (shouldHide) return null;

  return (
    <>
      <Button
        aria-label="Add task"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full p-0 shadow-lg"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>
      <TaskModal open={open} mode="create" onClose={() => setOpen(false)} />
    </>
  );
}

export default FloatingTaskButton;
