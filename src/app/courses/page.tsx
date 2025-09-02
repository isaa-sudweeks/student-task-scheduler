"use client";
import React, { useState, useEffect } from "react";
import { ArrowUpDown as ArrowUpDownIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { CourseSkeleton } from "@/components/CourseSkeleton";
import { api } from "@/server/api/react";
import { toast } from "@/lib/toast";
import { TrashIcon, CheckIcon, CaretSortIcon } from "@radix-ui/react-icons";
import { Alert } from "@/components/ui/alert";

const COLOR_OPTIONS = [
  "#000000",
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
];

export default function CoursesPage() {
  const utils = api.useUtils();
  const [page, setPage] = useState(1);
  const limit = 10;
  const {
    mutate: createCourse,
    isPending: isCreating,
    error: createError,
  } = api.course.create.useMutation({
    onSuccess: async () => {
      await utils.course.list.invalidate();
      toast.success("Course added.");
    },
    onError: (e) => toast.error(e.message || "Create failed."),
  });
  const [title, setTitle] = useState("");
  const [term, setTerm] = useState("");
  const [color, setColor] = useState("");
  const [description, setDescription] = useState("");
  const [sortBy, setSortBy] = useState<"title" | "term">("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [termFilter, setTermFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const isAddDisabled = isCreating || title.trim() === "";
  const handlePendingChange = () => {};

  const {
    mutate: deleteMany,
    isPending: isDeletingMany,
    error: deleteManyError,
  } = api.course.deleteMany.useMutation({
    onSuccess: async () => {
      await utils.course.list.invalidate();
      setSelectedIds([]);
      toast.success("Courses deleted.");
    },
    onError: (e) => toast.error(e.message || "Delete failed."),
  });

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id),
    );
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  if (isLoading)
    return (
      <ul aria-label="Loading courses" className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CourseSkeleton
            // eslint-disable-next-line react/no-array-index-key
            key={i}
          />
        ))}
      </ul>
    );
  if (error) return <p className="text-red-500">{error.message}</p>;
  const courseCount = courses.length;

  const sortedCourses = [...courses].sort((a, b) =>
    sortBy === "title"
      ? a.title.localeCompare(b.title)
      : (a.term ?? "").localeCompare(b.term ?? "") ||
        a.title.localeCompare(b.title),
  );
  if (sortDir === "desc") sortedCourses.reverse();

  const terms = Array.from(
    new Set(
      courses
        .map((c) => c.term)
        .filter((t): t is string => Boolean(t)),
    ),
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const t = title.trim();
    if (!t) return;
    if (courses.some((c) => c.title === t)) {
      toast.error("Course already exists.");
      return;
    }
    createCourse({
      title: t,
      term: term.trim() || undefined,
      color: color.trim() || undefined,
      description: description.trim() || undefined,
    });
    setTitle("");
    setTerm("");
    setColor("");
    setDescription("");
  };

  const query = debouncedSearch.toLowerCase();
  const filteredCourses = sortedCourses.filter((c) => {
    const q = query;
    const matches =
      c.title.toLowerCase().includes(q) ||
      (c.term ?? "").toLowerCase().includes(q) ||
      (c.color ?? "").toLowerCase().includes(q);
    return matches && (termFilter === "" || c.term === termFilter);
  });
  

  return (
    <div className="container mx-auto px-4">
      <main className="space-y-6 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
        <h1 className="text-2xl font-semibold md:col-span-2">Courses</h1>
        <div className="max-w-md mx-auto md:mx-0 rounded-lg border p-4 shadow-sm bg-card">
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <label htmlFor="course-title" className="flex flex-col gap-1">
              Course title
              <input
                id="course-title"
                className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
                placeholder="Course title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label htmlFor="course-term" className="flex flex-col gap-1">
              Term (optional)
              <input
                id="course-term"
                className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
                placeholder="Term (optional)"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            </label>
            <div className="flex flex-col gap-1">
              <span>Color (optional)</span>
              <div
                role="group"
                aria-label="Course color"
                className="flex items-center gap-2"
              >
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Select color ${c}`}
                      className={clsx(
                        "h-10 w-10 rounded border border-black/10 p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10",
                        color === c && "ring-2 ring-indigo-500 ring-offset-2",
                      )}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(color === c ? "" : c)}
                    />
                  ))}
                </div>
                <div
                  data-testid="color-preview"
                  className="h-6 w-6 rounded border border-black/10 dark:border-white/10"
                  style={{ backgroundColor: color || "#000000" }}
                />
              </div>
            </div>
            <Button type="submit" disabled={isAddDisabled}>
              Add Course
            </Button>
            {createError && (
              <Alert variant="error">{createError.message}</Alert>
            )}
          </form>
        </div>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={sortBy === "title" ? "primary" : "secondary"}
              onClick={() => setSortBy("title")}
            >
              Sort by Title
            </Button>
            <Button
              variant={sortBy === "term" ? "primary" : "secondary"}
              onClick={() => setSortBy("term")}
            >
              Sort by Term
            </Button>
            <Button
              variant="tertiary"
              onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
              aria-label="Toggle sort direction"
            >
              <ArrowUpDownIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="max-w-md">
            <div className="mb-4">
              <label htmlFor="term-filter" className="mb-2 block">
                Filter by term
              </label>
              <select
                id="term-filter"
                className="w-full rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
                value={termFilter}
                onChange={(e) => setTermFilter(e.target.value)}
              >
                <option value="">All terms</option>
                {terms.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <input
              className="mb-4 w-full rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
              placeholder="Search courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <ul className="space-y-4">
              {filteredCourses.length > 0 ? (
                filteredCourses.map((c) => (
                  <CourseItem
                    key={c.id}
                    course={c}
                    onPendingChange={() => {}}
                    selected={selectedIds.includes(c.id)}
                    onSelect={toggleSelect}
                  />
                ))
              ) : (
                <li>No courses found</li>
              )}
            </ul>
          </div>
          
          <div className="mb-4 flex justify-end">
            <Button
              variant="danger"
              disabled={selectedIds.length === 0 || isDeletingMany}
              onClick={() => {
                if (window.confirm("Delete selected courses?")) {
                  deleteMany({ ids: selectedIds });
                }
              }}
            >
              <TrashIcon className="mr-2 h-4 w-4" />
              Delete Selected
            </Button>
          </div>
          {deleteManyError && (
            <p className="mb-4 text-red-500">{deleteManyError.message}</p>
          )}
          
        </div>
      </main>
    </div>
  );
}

export function CourseItem({
  course,
  onPendingChange,
  selected,
  onSelect,
}: {
  course: { id: string; title: string; term: string | null; color: string | null };
  onPendingChange: (id: string, pending: boolean) => void;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
}) {
  const utils = api.useUtils();
  const {
    mutate: updateCourse,
    isPending: isUpdating,
    error: updateError,
  } = api.course.update.useMutation({
    onSuccess: async () => {
      await utils.course.list.invalidate();
      toast.success("Course updated.");
    },
    onError: (e) => toast.error(e.message || "Update failed."),
  });
  const {
    mutate: deleteCourse,
    isPending: isDeleting,
    error: deleteError,
  } = api.course.delete.useMutation({
    onSuccess: async () => {
      await utils.course.list.invalidate();
      toast.success("Course deleted.");
    },
    onError: (e) => toast.error(e.message || "Delete failed."),
  });
  const [title, setTitle] = useState(course.title);
  const [term, setTerm] = useState(course.term ?? "");
  const [color, setColor] = useState(course.color ?? "");
  const [description, setDescription] = useState(course.description ?? "");
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const titleId = `course-${course.id}-title`;
  const termId = `course-${course.id}-term`;
  const colorId = `course-${course.id}-color`;
  const descriptionId = `course-${course.id}-description`;
  const trimmedTitle = title.trim();
  const trimmedTerm = term.trim();
  const trimmedColor = color.trim();
  const trimmedDescription = description.trim();
  const hasChanges =
    trimmedTitle !== course.title ||
    trimmedTerm !== (course.term ?? "") ||
    trimmedColor !== (course.color ?? "") ||
    trimmedDescription !== (course.description ?? "");

  useEffect(() => {
    setHasPendingChanges(hasChanges);
    onPendingChange(course.id, hasChanges);
  }, [course.id, hasChanges, onPendingChange]);

  useEffect(() => {
    return () => {
      onPendingChange(course.id, false);
    };
  }, [course.id, onPendingChange]);

  const isSaveDisabled = isUpdating || !hasPendingChanges;
  return (
    <li>
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          aria-label={`Select ${course.title}`}
          className="mt-2"
          checked={selected}
          onChange={(e) => onSelect(course.id, e.target.checked)}
        />
        <div className="flex flex-col gap-2 rounded-lg border p-4 shadow-sm bg-card flex-1">
          <label htmlFor={titleId} className="flex flex-col gap-1">
            <span className="flex items-center gap-2">
              Title
              <span
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: color || "#000" }}
              />
            </span>
            <input
              id={titleId}
              className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label htmlFor={termId} className="flex flex-col gap-1">
            Term
            <input
              id={termId}
              className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </label>
          <label htmlFor={colorId} className="flex flex-col gap-1">
            Color
            <div className="flex items-center gap-2">
              <input
                id={colorId}
                type="color"
                aria-label="Course color"
                className="h-10 w-10 rounded border border-black/10 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
                value={color || "#000000"}
                onChange={(e) => setColor(e.target.value)}
              />
              <div
                className="h-6 w-6 rounded border border-black/10 dark:border-white/10"
                style={{ backgroundColor: color || "#000000" }}
              />
            </div>
          </label>
          <div className="flex gap-2">
            <Button
              disabled={isSaveDisabled}
              onClick={() =>
                updateCourse({
                  id: course.id,
                  title: trimmedTitle,
                  term: trimmedTerm || null,
                  color: trimmedColor || null,
                })
              }
            >
              Save
            </Button>
            <Button
              variant="danger"
              disabled={isDeleting}
              onClick={() => setShowDeleteDialog(true)}
            >
              Delete
            </Button>
          </div>
          <AlertDialog
            open={showDeleteDialog}
            title="Delete this course?"
            onCancel={() => setShowDeleteDialog(false)}
            onConfirm={() => {
              deleteCourse({ id: course.id });
              setShowDeleteDialog(false);
            }}
            confirmText="Delete"
            confirmDisabled={isDeleting}
          />
          {updateError && <p className="text-red-500">{updateError.message}</p>}
          {deleteError && <p className="text-red-500">{deleteError.message}</p>}
        </div>
      </div>
    </li>
  );
}
