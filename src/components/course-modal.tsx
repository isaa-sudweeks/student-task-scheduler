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
  const [instructorName, setInstructorName] = useState("");
  const [instructorEmail, setInstructorEmail] = useState("");
  const [officeHours, setOfficeHours] = useState("");
  const [titleError, setTitleError] = useState("");
  const [termError, setTermError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");
  const [instructorEmailError, setInstructorEmailError] = useState("");
  const [officeHoursError, setOfficeHoursError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (isEdit && course) {
      setTitle(course.title);
      setTerm(course.term ?? "");
      setColor(course.color ?? "#000000");
      setDescription(course.description ?? "");
      setInstructorName(course.instructorName ?? "");
      setInstructorEmail(course.instructorEmail ?? "");
      setOfficeHours((course.officeHours ?? []).join("\n"));
    } else {
      setTitle("");
      setTerm("");
      setColor("#000000");
      setDescription("");
      setInstructorName("");
      setInstructorEmail("");
      setOfficeHours("");
    }
    setTitleError("");
    setTermError("");
    setDescriptionError("");
    setInstructorEmailError("");
    setOfficeHoursError("");
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
    const name = instructorName.trim();
    const email = instructorEmail.trim();
    const officeHourEntries = officeHours
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
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
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInstructorEmailError("Enter a valid instructor email.");
      hasError = true;
    }
    if (officeHourEntries.some((entry) => entry.length > 200)) {
      setOfficeHoursError("Office hour entries must be 200 characters or fewer.");
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
        instructorName: name || null,
        instructorEmail: email || null,
        officeHours: officeHourEntries,
      });
    } else {
      create.mutate({
        title: t,
        term: tm || undefined,
        color: color || undefined,
        description: d || undefined,
        instructorName: name || undefined,
        instructorEmail: email || undefined,
        officeHours: officeHourEntries,
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
      <div className="space-y-1">
        <label htmlFor="course-instructor-name" className="text-sm font-medium">
          Instructor name (optional)
        </label>
        <Input
          id="course-instructor-name"
          placeholder="Instructor name"
          value={instructorName}
          onChange={(e) => setInstructorName(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="course-instructor-email" className="text-sm font-medium">
          Instructor email (optional)
        </label>
        <Input
          id="course-instructor-email"
          placeholder="name@example.edu"
          value={instructorEmail}
          onChange={(e) => {
            setInstructorEmail(e.target.value);
            if (instructorEmailError) setInstructorEmailError("");
          }}
          error={instructorEmailError}
        />
        {instructorEmailError && (
          <p className="text-sm text-red-500">{instructorEmailError}</p>
        )}
      </div>
      <div className="space-y-1">
        <label htmlFor="course-office-hours" className="text-sm font-medium">
          Office hours (one per line)
        </label>
        <Textarea
          id="course-office-hours"
          placeholder="e.g. Monday 10:00-11:00 AM"
          value={officeHours}
          onChange={(e) => {
            setOfficeHours(e.target.value);
            if (officeHoursError) setOfficeHoursError("");
          }}
          rows={3}
          error={officeHoursError}
        />
        {officeHoursError && (
          <p className="text-sm text-red-500">{officeHoursError}</p>
        )}
      </div>
    </Modal>
  );
}

export default CourseModal;

