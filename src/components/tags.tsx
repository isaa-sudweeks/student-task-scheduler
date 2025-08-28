import React from 'react';

interface TagsProps {
  /** List of tag labels to display */
  items: string[];
  /** Maximum number of tags to show before collapsing into a "+N" counter. Defaults to 5. */
  maxVisible?: number;
}

/**
 * Displays a list of tags as small rounded pills. When the number of tags
 * exceeds `maxVisible`, the remaining count is summarized as a "+N" pill.
 */
export function Tags({ items, maxVisible = 5 }: TagsProps) {
  const visible = items.slice(0, maxVisible);
  const hiddenCount = items.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1 text-[11px]">
      {visible.map((tag) => (
        <span
          key={tag}
          className="px-2 py-0.5 rounded-full bg-neutral-100"
        >
          {tag}
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="px-2 py-0.5 rounded-full bg-neutral-100">+{hiddenCount}</span>
      )}
    </div>
  );
}

export default Tags;
