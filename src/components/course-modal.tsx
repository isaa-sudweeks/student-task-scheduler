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

type MeetingDay =
  | "SUNDAY"
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY";

type MeetingFormState = {
  dayOfWeek: MeetingDay;
  startTime: string;
  endTime: string;
  location: string;
};

const WEEKDAY_OPTIONS: { value: MeetingDay; label: string }[] = [
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
  { value: "SUNDAY", label: "Sunday" },
];

const minutesToTime = (minutes: number) => {
  const hrs = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hrs}:${mins}`;
};

const createEmptyMeeting = (): MeetingFormState => ({
  dayOfWeek: "MONDAY",
  startTime: "",
  endTime: "",
  location: "",
});

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
  const [meetings, setMeetings] = useState<MeetingFormState[]>([]);
  const [meetingError, setMeetingError] = useState("");

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
      const parsedMeetings = Array.isArray(course.meetings)
        ? course.meetings.map((meeting) => ({
          dayOfWeek: meeting.dayOfWeek as MeetingDay,
          startTime: minutesToTime(meeting.startMinutes),
          endTime: minutesToTime(meeting.endMinutes),
          location: meeting.location ?? "",
        }))
        : [];
      setMeetings(parsedMeetings.length ? parsedMeetings : [createEmptyMeeting()]);
    } else {
      setTitle("");
      setTerm("");
      setColor("#000000");
      setDescription("");
      setInstructorName("");
      setInstructorEmail("");
      setOfficeHours("");
      setMeetings([createEmptyMeeting()]);
    }
    setTitleError("");
    setTermError("");
    setDescriptionError("");
    setInstructorEmailError("");
    setOfficeHoursError("");
    setMeetingError("");
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
    const cleanedMeetings = meetings
      .map((meeting) => ({
        ...meeting,
        dayOfWeek: meeting.dayOfWeek,
        startTime: meeting.startTime.trim(),
        endTime: meeting.endTime.trim(),
        location: meeting.location.trim(),
      }))
      .filter((meeting) => meeting.startTime || meeting.endTime || meeting.location);

    if (cleanedMeetings.length > 0) {
      for (let index = 0; index < cleanedMeetings.length; index++) {
        const meeting = cleanedMeetings[index];
        if (!meeting.startTime || !meeting.endTime) {
          setMeetingError("Please provide start and end times for each meeting.");
          hasError = true;
          break;
        }
        const startParts = meeting.startTime.split(":").map(Number);
        const endParts = meeting.endTime.split(":").map(Number);
        if (startParts.length !== 2 || endParts.length !== 2) {
          setMeetingError("Times must be in HH:MM format.");
          hasError = true;
          break;
        }
        const startMinutes = startParts[0] * 60 + startParts[1];
        const endMinutes = endParts[0] * 60 + endParts[1];
        if (endMinutes <= startMinutes) {
          setMeetingError("Meeting end time must be after the start time.");
          hasError = true;
          break;
        }
      }
    }
    setMeetingError("");

    const meetingPayload = cleanedMeetings.map((meeting) => ({
      dayOfWeek: meeting.dayOfWeek,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      location: meeting.location || undefined,
    }));
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
        meetings: meetingPayload,
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
        meetings: meetingPayload.length ? meetingPayload : undefined,
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
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Meeting schedule</label>
          <Button
            type="button"
            variant="tertiary"
            onClick={() => {
              setMeetingError("");
              setMeetings((prev) => [...prev, createEmptyMeeting()]);
            }}
          >
            Add meeting
          </Button>
        </div>
        {meetings.map((meeting, index) => (
          <div key={index} className="grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Day
              </label>
              <select
                className="w-full rounded border border-black/10 bg-transparent px-2 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
                value={meeting.dayOfWeek}
                onChange={(e) =>
                  setMeetings((prev) => {
                    const next = [...prev];
                    next[index] = { ...next[index], dayOfWeek: e.target.value as MeetingDay };
                    return next;
                  })
                }
              >
                {WEEKDAY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Start
              </label>
              <input
                type="time"
                className="w-full rounded border border-black/10 bg-transparent px-2 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
                value={meeting.startTime}
                onChange={(e) => {
                  setMeetingError("");
                  setMeetings((prev) => {
                    const next = [...prev];
                    next[index] = { ...next[index], startTime: e.target.value };
                    return next;
                  });
                }
                }
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                End
              </label>
              <input
                type="time"
                className="w-full rounded border border-black/10 bg-transparent px-2 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
                value={meeting.endTime}
                onChange={(e) => {
                  setMeetingError("");
                  setMeetings((prev) => {
                    const next = [...prev];
                    next[index] = { ...next[index], endTime: e.target.value };
                    return next;
                  });
                }
                }
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Location (optional)
              </label>
              <Input
                placeholder="Building / Room"
                value={meeting.location}
                onChange={(e) => {
                  setMeetingError("");
                  setMeetings((prev) => {
                    const next = [...prev];
                    next[index] = { ...next[index], location: e.target.value };
                    return next;
                  });
                }
                }
              />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <Button
                type="button"
                variant="tertiary"
                onClick={() => {
                  setMeetingError("");
                  setMeetings((prev) => prev.filter((_, idx) => idx !== index));
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
        {meetingError && <p className="text-sm text-red-500">{meetingError}</p>}
      </div>
    </Modal>
  );
}


