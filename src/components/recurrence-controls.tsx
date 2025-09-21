"use client";
import React from "react";

interface RecurrenceControlsProps {
  recurrenceType: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  onRecurrenceTypeChange: (value: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY') => void;
  recurrenceInterval: number;
  onRecurrenceIntervalChange: (value: number) => void;
  recurrenceCount: number | '';
  onRecurrenceCountChange: (value: number | '') => void;
  recurrenceUntil: string;
  onRecurrenceUntilChange: (value: string) => void;
}

export function RecurrenceControls({
  recurrenceType,
  onRecurrenceTypeChange,
  recurrenceInterval,
  onRecurrenceIntervalChange,
  recurrenceCount,
  onRecurrenceCountChange,
  recurrenceUntil,
  onRecurrenceUntilChange,
}: RecurrenceControlsProps) {
  const disableCount = recurrenceUntil !== '';
  const disableUntil = recurrenceCount !== '';
  const showConflict = disableCount && disableUntil;
  return (
    <>
      <div className="flex items-center gap-4">
        <label htmlFor="recurrenceType" className="w-28 text-sm font-medium">
          Recurrence
        </label>
        <select
          id="recurrenceType"
          className="flex-1 rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
          value={recurrenceType}
          onChange={(e) => onRecurrenceTypeChange(e.target.value as typeof recurrenceType)}
        >
          <option value="NONE">None</option>
          <option value="DAILY">Daily</option>
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
        </select>
      </div>
      {recurrenceType !== 'NONE' && (
        <div className="flex items-center gap-4">
          <label htmlFor="recurrenceInterval" className="w-28 text-sm font-medium">
            Interval
          </label>
          <input
            id="recurrenceInterval"
            type="number"
            min={1}
            className="flex-1 rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
            value={recurrenceInterval}
            onChange={(e) => onRecurrenceIntervalChange(parseInt(e.target.value, 10) || 1)}
          />
        </div>
      )}
      {recurrenceType !== 'NONE' && (
        <>
          <div className="flex items-center gap-4">
            <label htmlFor="recurrenceCount" className="w-28 text-sm font-medium">
              End after
            </label>
            <input
              id="recurrenceCount"
              type="number"
              min={1}
              className="flex-1 rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:border-white/10"
              value={recurrenceCount}
              onChange={(e) =>
                onRecurrenceCountChange(e.target.value ? parseInt(e.target.value, 10) : '')
              }
              disabled={disableCount}
            />
          </div>
          <div className="flex items-center gap-4">
            <label htmlFor="recurrenceUntil" className="w-28 text-sm font-medium">
              End on
            </label>
            <input
              id="recurrenceUntil"
              type="date"
              className="flex-1 rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:border-white/10"
              value={recurrenceUntil}
              onChange={(e) => onRecurrenceUntilChange(e.target.value)}
              disabled={disableUntil}
            />
          </div>
          {showConflict && (
            <p className="pl-28 text-sm text-red-600">
              Choose either &ldquo;End after&rdquo; or &ldquo;End on&rdquo;, not both.
            </p>
          )}
        </>
      )}
    </>
  );
}

export default RecurrenceControls;
