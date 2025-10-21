// @vitest-environment jsdom
import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

import ProjectPage from "./page";

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

const {
  projectDataRef,
  invalidateGetMock,
  invalidateListMock,
  mutateAsyncMock,
  mutateAsyncSpy,
  projectUseQueryMock,
  projectUpdateUseMutationMock,
  latestOptionsRef,
} = vi.hoisted(() => {
  const projectDataRef = {
    current: null as {
      id: string;
      title: string;
      description: string | null;
      instructionsUrl: string | null;
    } | null,
  };
  const invalidateGetMock = vi.fn();
  const invalidateListMock = vi.fn();
  const mutateAsyncMock = vi.fn();
  const latestOptionsRef: {
    current:
      | {
          onSuccess?: (result: unknown, variables: any, context: unknown) => unknown;
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
  const projectUseQueryMock = vi.fn(() => ({ data: projectDataRef.current }));
  const projectUpdateUseMutationMock = vi.fn(
    (
      options?: {
        onSuccess?: (result: unknown, variables: any, context: unknown) => unknown;
      }
    ) => {
      latestOptionsRef.current = options;
      return { mutateAsync: mutateAsyncSpy };
    }
  );

  return {
    projectDataRef,
    invalidateGetMock,
    invalidateListMock,
    mutateAsyncMock,
    mutateAsyncSpy,
    projectUseQueryMock,
    projectUpdateUseMutationMock,
    latestOptionsRef,
  };
});

vi.mock("@/server/api/react", () => ({
  api: {
    useUtils: () => ({
      project: {
        get: { invalidate: invalidateGetMock },
        list: { invalidate: invalidateListMock },
      },
    }),
    project: {
      get: { useQuery: projectUseQueryMock },
      update: { useMutation: projectUpdateUseMutationMock },
    },
  },
}));

const FIXED_DATE = new Date("2099-01-01T00:00:00Z");

beforeAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  projectDataRef.current = {
    id: "project-1",
    title: "Capstone",
    description: null,
    instructionsUrl: null,
  };
  invalidateGetMock.mockReset();
  invalidateListMock.mockReset();
  mutateAsyncMock.mockReset();
  mutateAsyncSpy.mockClear();
  latestOptionsRef.current = undefined;
  projectUseQueryMock.mockClear();
  projectUpdateUseMutationMock.mockClear();
  toastSuccess.mockReset();
  toastError.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

afterAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_DATE);
  vi.resetModules();
});

describe("ProjectPage upload", () => {
  it("uploads instructions and shows success toast", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ url: "https://example.com/instructions.pdf" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    mutateAsyncMock.mockResolvedValue(undefined);

    render(<ProjectPage params={{ id: "project-1" }} />);
    const input = screen.getByLabelText("Upload instructions") as HTMLInputElement;
    const file = new File(["dummy"], "instructions.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [file] } });
    expect(input).toBeDisabled();
    expect(screen.getByText("Uploading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(mutateAsyncSpy).toHaveBeenCalledWith({
        id: "project-1",
        instructionsUrl: "https://example.com/instructions.pdf",
      });
    });

    expect(toastSuccess).toHaveBeenCalledWith("Instructions uploaded.");
    expect(invalidateGetMock).toHaveBeenCalledWith({ id: "project-1" });
    expect(invalidateListMock).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(input).not.toBeDisabled());
  });

  it("rejects non-PDF files", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectPage params={{ id: "project-1" }} />);
    const input = screen.getByLabelText("Upload instructions") as HTMLInputElement;
    const file = new File(["dummy"], "notes.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(toastError).toHaveBeenCalledWith("Only PDF files can be uploaded.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mutateAsyncSpy).not.toHaveBeenCalled();
  });

  it("shows error toast when upload fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: "Upload failed" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectPage params={{ id: "project-1" }} />);
    const input = screen.getByLabelText("Upload instructions") as HTMLInputElement;
    const file = new File(["dummy"], "instructions.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Upload failed");
    });
    expect(mutateAsyncSpy).not.toHaveBeenCalled();
  });

  it("shows error toast when mutation fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ url: "https://example.com/instructions.pdf" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    mutateAsyncMock.mockRejectedValue(new Error("Save failed"));

    render(<ProjectPage params={{ id: "project-1" }} />);
    const input = screen.getByLabelText("Upload instructions") as HTMLInputElement;
    const file = new File(["dummy"], "instructions.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Save failed");
    });
    expect(invalidateGetMock).not.toHaveBeenCalled();
    expect(invalidateListMock).not.toHaveBeenCalled();
  });
});
