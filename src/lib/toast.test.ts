import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const base = vi.fn();
  const success = vi.fn();
  const error = vi.fn();
  const dismiss = vi.fn();
  return { base, success, error, dismiss };
});

vi.mock("react-hot-toast", () => {
  const t = Object.assign(mocks.base, {
    success: mocks.success,
    error: mocks.error,
    dismiss: mocks.dismiss,
  });
  return { toast: t };
});

import { toast } from "./toast";

beforeEach(() => {
  mocks.base.mockReset();
  mocks.success.mockReset();
  mocks.error.mockReset();
  mocks.dismiss.mockReset();
});

describe("toast utility", () => {
  it("shows success toast", () => {
    toast.success("Done.");
    expect(mocks.dismiss).toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith("Done.", { duration: 3500 });
  });

  it("shows error toast", () => {
    toast.error("Oops.");
    expect(mocks.dismiss).toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith("Oops.", { duration: 3500 });
  });

  it("shows info toast", () => {
    toast.info("FYI.");
    expect(mocks.dismiss).toHaveBeenCalled();
    expect(mocks.base).toHaveBeenCalledWith("FYI.", { duration: 3500 });
  });
});
