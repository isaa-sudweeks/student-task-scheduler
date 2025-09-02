"use client";
import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import { api } from "@/server/api/react";
import type { RouterOutputs } from "@/server/api/root";

export type Course = RouterOutputs["course"]["list"][number];

interface CourseModalProps {
  open: boolean;
  mode: "create" | "edit";
  onClose: () => void;
  course?: Course;
}

export function CourseModal({ open, mode, onClose, course }: CourseModalProps) {
  const utils = api.useUtils();
  const isEdit = mode === "edit";

  const [title, setTitle] = useState("");
  const [term, setTerm] = useState("");
  const [color, setColor] = useState("#000000");
  const [description, setDescription] = useState("");
  const [titleError, setTitleError] = useState("");
  const [termError, setTermError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (isEdit && course) {
      setTitle(course.title);
      setTerm(course.term ?? "");
      setColor(course.color ?? "#000000");
      setDescription(course.description ?? "");
    } else {
      setTitle("");
      setTerm("");
      setColor("#000000");
      setDescription("");
    }
    setTitleError("");
    setTermError("");
    setDescriptionError("");
  }, [open, isEdit, course]);

  const create = api.course.create.useMutation({
    onSuccess: () => {
      toast.success("Saved!");
      utils.course.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Create failed."),
  });

  const update = api.course.update.useMutation({
    onSuccess: () => {
      toast.success("Saved!");
      utils.course.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Update failed."),
  });

  const del = api.course.delete.useMutation({
    onSuccess: () => {
      toast.success("Saved!");
      utils.course.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Delete failed."),
  });

  const handleSave = () => {
    const t = title.trim();
    const tm = term.trim();
    const d = description.trim();
    let hasError = false;
    if (t.length < 1 || t.length > 200) {
      setTitleError("Title must be between 1 and 200 characters.");
      hasError = true;
    }
    if (tm.length > 100) {
      setTermError("Term must be at most 100 characters.");
      hasError = true;
    }
    if (d.length > 1000) {
      setDescriptionError("Description must be at most 1000 characters.");
      hasError = true;
    }
    if (hasError) return;
    if (isEdit && course) {
      update.mutate({
        id: course.id,
        title: t,
        term: tm || null,
        color: color || null,
        description: d || null,
      });
    } else {
      create.mutate({
        title: t,
        term: tm || undefined,
        color: color || undefined,
        description: d || undefined,
      });
    }
  };

  const footer = (
    <>
      {isEdit && course && (
        <Button
          variant="destructive"
          className="mr-auto"
          disabled={del.isPending}
          onClick={() => {
            if (window.confirm("Delete this course?")) {
              del.mutate({ id: course.id });
            }
          }}
        >
          {del.isPending ? "Deleting..." : "Delete"}
        </Button>
      )}
      <Button variant="tertiary" onClick={onClose}>
        Cancel
      </Button>
      <Button disabled={create.isPending || update.isPending} onClick={handleSave}>
        {create.isPending || update.isPending ? "Saving..." : "Save"}
      </Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Course" : "New Course"}
      footer={footer}
    >
      <div className="space-y-1">
        <label htmlFor="course-title" className="text-sm font-medium">
          Title
        </label>
        <Input
          id="course-title"
          placeholder="Course title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (titleError) setTitleError("");
          }}
          error={titleError}
        />
        {titleError && <p className="text-sm text-red-500">{titleError}</p>}
      </div>
      <div className="space-y-1">
        <label htmlFor="course-term" className="text-sm font-medium">
          Term (optional)
        </label>
        <Input
          id="course-term"
          placeholder="Term (optional)"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            if (termError) setTermError("");
          }}
          error={termError}
        />
        {termError && <p className="text-sm text-red-500">{termError}</p>}
      </div>
      <div className="space-y-1">
        <label htmlFor="course-color" className="text-sm font-medium">
          Color (optional)
        </label>
        <input
          id="course-color"
          type="color"
          className="h-10 w-10 rounded border border-black/10 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="course-description" className="text-sm font-medium">
          Description (optional)
        </label>
        <Textarea
          id="course-description"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (descriptionError) setDescriptionError("");
          }}
          error={descriptionError}
          rows={4}
        />
        {descriptionError && (
          <p className="text-sm text-red-500">{descriptionError}</p>
        )}
      </div>
    </Modal>
  );
}

export default CourseModal;

