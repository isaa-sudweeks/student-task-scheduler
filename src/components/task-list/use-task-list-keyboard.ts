import { useState, useRef, useEffect } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";

export function useTaskListKeyboard(
  count: number,
  useVirtual: boolean,
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>,
  parentRef: React.RefObject<HTMLDivElement>
) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      const container = parentRef.current;
      if (!container || !target || !container.contains(target)) return;
      const focusable = target.closest(
        "input, textarea, select, button, a, [contenteditable], [tabindex]:not([tabindex='-1'])"
      );
      if (focusable) return;
      const overlay = document.querySelector(
        "[role='dialog'], [role='menu'], [role='listbox']:not([data-task-list])"
      );
      if (overlay) return;
      if (e.key === "ArrowDown" || e.key.toLowerCase() === "j") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, count - 1));
      } else if (e.key === "ArrowUp" || e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, parentRef]);

  useEffect(() => {
    if (selectedIndex < 0 || selectedIndex >= count) return;
    if (useVirtual) {
      rowVirtualizer.scrollToIndex(selectedIndex);
    } else {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, useVirtual, rowVirtualizer, count]);

  return { itemRefs };
}
