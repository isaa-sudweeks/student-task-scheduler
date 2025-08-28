import React, { useState } from "react";

export function ShortcutsPopover() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Show shortcuts"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border bg-white p-3 text-sm shadow-md dark:bg-slate-800">
          <ul className="space-y-1">
            <li className="flex justify-between"><span>Create task</span><span className="font-mono">N</span></li>
            <li className="flex justify-between"><span>Focus search</span><span className="font-mono">/</span></li>
            <li className="flex justify-between"><span>Change filter</span><span className="font-mono">Ctrl+←/→</span></li>
            <li className="flex justify-between"><span>Move selection</span><span className="font-mono">J/K or ↑/↓</span></li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default ShortcutsPopover;
