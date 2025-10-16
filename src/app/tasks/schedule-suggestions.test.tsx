// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import { createAcceptSuggestionHandler } from './schedule-suggestions';
import type { RouterOutputs } from '@/server/api/root';

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

const makeSetter = <T,>(state: { current: T }) =>
  vi.fn((updater: React.SetStateAction<T>) => {
    state.current = typeof updater === 'function' ? (updater as (prev: T) => T)(state.current) : updater;
    return state.current;
  });

type Suggestion = RouterOutputs['task']['scheduleSuggestions']['suggestions'][number];

describe('createAcceptSuggestionHandler', () => {
  beforeEach(() => {
    toastMock.success.mockReset();
    toastMock.error.mockReset();
    toastMock.info.mockReset();
  });

  const baseSuggestion: Suggestion = {
    taskId: 't1',
    startAt: new Date('2099-01-01T09:00:00Z'),
    endAt: new Date('2099-01-01T10:00:00Z'),
    origin: 'fallback',
  } as Suggestion;

  it('schedules a suggestion and tracks success', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ event: {}, googleSyncWarning: false });
    const suggestionsState = { current: [baseSuggestion] as Suggestion[] };
    const acceptedIdsState = { current: new Set<string>() };
    const setSuggestions = makeSetter(suggestionsState);
    const setAcceptedIds = makeSetter(acceptedIdsState);
    const handler = createAcceptSuggestionHandler({
      eventSchedule: { mutateAsync },
      settings: { dayWindowStartHour: 8, dayWindowEndHour: 18 },
      setSuggestions,
      setAcceptedIds,
      toast: toastMock,
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await handler(baseSuggestion);

    expect(mutateAsync).toHaveBeenCalledWith({
      taskId: 't1',
      startAt: baseSuggestion.startAt,
      durationMinutes: 60,
      dayWindowStartHour: 8,
      dayWindowEndHour: 18,
    });
    expect(suggestionsState.current).toEqual([]);
    expect(Array.from(acceptedIdsState.current)).toEqual(['t1']);
    expect(toastMock.success).toHaveBeenCalledWith('Scheduled task');
    expect(toastMock.info).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('shows a warning toast when Google sync fails', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ event: {}, googleSyncWarning: true });
    const suggestionsState = { current: [baseSuggestion] as Suggestion[] };
    const acceptedIdsState = { current: new Set<string>() };
    const setSuggestions = makeSetter(suggestionsState);
    const setAcceptedIds = makeSetter(acceptedIdsState);
    const handler = createAcceptSuggestionHandler({
      eventSchedule: { mutateAsync },
      settings: { dayWindowStartHour: 8, dayWindowEndHour: 18 },
      setSuggestions,
      setAcceptedIds,
      toast: toastMock,
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await handler(baseSuggestion);

    expect(toastMock.success).toHaveBeenCalledWith('Scheduled task');
    expect(toastMock.info).toHaveBeenCalledWith('Event saved locally, but Google Calendar sync failed.');
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
