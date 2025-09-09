import { useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export function useTaskListVirtualization(
  count: number,
  tasks: any
) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
  });
  const useVirtual = count >= 20;

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (!tasks.hasNextPage || tasks.isFetchingNextPage) return;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
        void tasks.fetchNextPage();
      }
    };
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [tasks]);

  return { parentRef, rowVirtualizer, useVirtual };
}
