// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
expect.extend(matchers);

import SettingsPage from "./page";

describe("SettingsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("loads stored day window hours", () => {
    window.localStorage.setItem("dayWindowStartHour", "6");
    window.localStorage.setItem("dayWindowEndHour", "20");
    render(<SettingsPage />);
    const start = screen.getByLabelText(/day start hour/i) as HTMLInputElement;
    const end = screen.getByLabelText(/day end hour/i) as HTMLInputElement;
    expect(start.value).toBe("6");
    expect(end.value).toBe("20");
  });

  it("loads stored default duration", () => {
    window.localStorage.setItem("defaultDurationMinutes", "45");
    render(<SettingsPage />);
    const duration = screen.getByLabelText(/default duration/i) as HTMLInputElement;
    expect(duration.value).toBe("45");
  });

  it("loads stored google sync toggle", () => {
    window.localStorage.setItem("googleSyncEnabled", "true");
    render(<SettingsPage />);
    const checkbox = screen.getByLabelText(/enable google calendar sync/i) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("defaults the AI provider to none", () => {
    render(<SettingsPage />);
    const provider = screen.getByLabelText(/ai provider/i) as HTMLSelectElement;
    expect(provider.value).toBe("NONE");
    const urlInput = screen.getByLabelText(/lm studio url/i) as HTMLInputElement;
    expect(urlInput.value).toBe("http://localhost:1234");
    expect(urlInput).toBeDisabled();
  });

  it("enables LM Studio configuration when selected", () => {
    render(<SettingsPage />);
    const provider = screen.getByLabelText(/ai provider/i) as HTMLSelectElement;
    fireEvent.change(provider, { target: { value: "LM_STUDIO" } });
    const urlInput = screen.getByLabelText(/lm studio url/i) as HTMLInputElement;
    expect(urlInput).not.toBeDisabled();
  });
});
