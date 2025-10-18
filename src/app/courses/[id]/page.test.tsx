// @vitest-environment jsdom
import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

import CoursePage from "./page";

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("@/components/task-list", () => ({
  TaskList: () => <div data-testid="task-list" />,
}));

vi.mock("@/components/task-modal", () => ({
  TaskModal: () => <div data-testid="task-modal" />,
}));

const { coursesDataRef, invalidateMock, mutateAsyncMock, mutateAsyncSpy, courseUseQueryMock, courseUpdateUseMutationMock, latestOptionsRef } =
  vi.hoisted(() => {
    const coursesDataRef = {
      current: [] as Array<{
        id: string;
        title: string;
        term: string | null;
        syllabusUrl: string | null;
      }>,
    };
    const invalidateMock = vi.fn();
    const mutateAsyncMock = vi.fn();
    const latestOptionsRef: {
      current:
        | {
            onSuccess?: (result: unknown, variables: unknown, context: unknown) => unknown;
          }
        | undefined;
    } = { current: undefined };
    const mutateAsyncSpy = vi.fn(async (variables: unknown) => {
      const result = await mutateAsyncMock(variables);
      const onSuccess = latestOptionsRef.current?.onSuccess;
      if (onSuccess) {
        await onSuccess(result, variables, undefined);
      }
      return result;
    });
    const courseUseQueryMock = vi.fn(
      (
        _input: unknown,
        opts?: { select?: (courses: typeof coursesDataRef.current) => unknown }
      ) => {
        const data = opts?.select
          ? opts.select(coursesDataRef.current)
          : coursesDataRef.current;
        return { data };
      }
    );
    const courseUpdateUseMutationMock = vi.fn(
      (
        options?: {
          onSuccess?: (result: unknown, variables: unknown, context: unknown) => unknown;
        }
      ) => {
        latestOptionsRef.current = options;
        return { mutateAsync: mutateAsyncSpy };
      }
    );

    return {
      coursesDataRef,
      invalidateMock,
      mutateAsyncMock,
      mutateAsyncSpy,
      courseUseQueryMock,
      courseUpdateUseMutationMock,
      latestOptionsRef,
    };
  });

vi.mock("@/server/api/react", () => ({
  api: {
    useUtils: () => ({ course: { list: { invalidate: invalidateMock } } }),
    course: {
      list: { useQuery: courseUseQueryMock },
      update: { useMutation: courseUpdateUseMutationMock },
    },
  },
}));

beforeEach(() => {
  coursesDataRef.current = [
    {
      id: "course-1",
      title: "Intro to Testing",
      term: "Fall",
      syllabusUrl: null,
    },
  ];
  invalidateMock.mockReset();
  mutateAsyncMock.mockReset();
  mutateAsyncSpy.mockClear();
  latestOptionsRef.current = undefined;
  courseUseQueryMock.mockClear();
  courseUpdateUseMutationMock.mockClear();
  toastSuccess.mockReset();
  toastError.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

afterAll(() => {
  vi.resetModules();
});

describe("CoursePage upload", () => {
  it("uploads a PDF and shows success toast", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ url: "https://example.com/syllabus.pdf" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    mutateAsyncMock.mockResolvedValue(undefined);

    render(<CoursePage params={{ id: "course-1" }} />);
    const input = screen.getByLabelText("Upload syllabus") as HTMLInputElement;
    const file = new File(["dummy"], "syllabus.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [file] } });
    expect(input).toBeDisabled();
    expect(screen.getByText("Uploading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        id: "course-1",
        syllabusUrl: "https://example.com/syllabus.pdf",
      });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith("Syllabus uploaded.");
    expect(invalidateMock).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(input).not.toBeDisabled());
  });

  it("rejects non-PDF files", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<CoursePage params={{ id: "course-1" }} />);
    const input = screen.getByLabelText("Upload syllabus") as HTMLInputElement;
    const file = new File(["dummy"], "notes.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(toastError).toHaveBeenCalledWith("Only PDF files can be uploaded.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it("shows error toast when upload fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: "Something broke" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CoursePage params={{ id: "course-1" }} />);
    const input = screen.getByLabelText("Upload syllabus") as HTMLInputElement;
    const file = new File(["dummy"], "syllabus.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Something broke");
    });
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it("shows error toast when mutation fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ url: "https://example.com/syllabus.pdf" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    mutateAsyncMock.mockRejectedValue(new Error("Save failed"));

    render(<CoursePage params={{ id: "course-1" }} />);
    const input = screen.getByLabelText("Upload syllabus") as HTMLInputElement;
    const file = new File(["dummy"], "syllabus.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Save failed");
    });
    expect(invalidateMock).not.toHaveBeenCalled();
  });
});
