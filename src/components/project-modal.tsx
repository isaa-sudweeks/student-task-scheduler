"use client";
import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import { api } from "@/server/api/react";
import type { RouterOutputs } from "@/server/api/root";

export type Project = RouterOutputs["project"]["list"][number];

interface ProjectModalProps {
  open: boolean;
  mode: "create" | "edit";
  onClose: () => void;
  project?: Project;
}

export function ProjectModal({ open, mode, onClose, project }: ProjectModalProps) {
  const utils = api.useUtils();
  const isEdit = mode === "edit";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [titleError, setTitleError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (isEdit && project) {
      setTitle(project.title);
      setDescription(project.description ?? "");
    } else {
      setTitle("");
      setDescription("");
    }
    setTitleError("");
    setDescriptionError("");
  }, [open, isEdit, project]);

  const create = api.project.create.useMutation({
    onSuccess: () => {
      toast.success("Saved!");
      utils.project.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Create failed."),
  });

  const update = api.project.update.useMutation({
    onSuccess: () => {
      toast.success("Saved!");
      utils.project.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Update failed."),
  });

  const del = api.project.delete.useMutation({
    onSuccess: () => {
      toast.success("Saved!");
      utils.project.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Delete failed."),
  });

  const handleSave = () => {
    const t = title.trim();
    const d = description.trim();
    let hasError = false;
    if (t.length < 1 || t.length > 200) {
      setTitleError("Title must be between 1 and 200 characters.");
      hasError = true;
    }
    if (d.length > 1000) {
      setDescriptionError("Description must be at most 1000 characters.");
      hasError = true;
    }
    if (hasError) return;
    if (isEdit && project) {
      update.mutate({ id: project.id, title: t, description: d || null });
    } else {
      create.mutate({ title: t, description: d || undefined });
    }
  };

  const footer = (
    <>
      {isEdit && project && (
        <Button
          variant="destructive"
          className="mr-auto"
          disabled={del.isPending}
          onClick={() => {
            if (window.confirm("Delete this project?")) {
              del.mutate({ id: project.id });
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
      title={isEdit ? "Edit Project" : "New Project"}
      footer={footer}
    >
      <div className="space-y-1">
        <label htmlFor="project-title" className="text-sm font-medium">
          Title
        </label>
        <Input
          id="project-title"
          placeholder="Project title"
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
        <label
          htmlFor="project-description"
          className="text-sm font-medium"
        >
          Description (optional)
        </label>
        <Textarea
          id="project-description"
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

export default ProjectModal;
