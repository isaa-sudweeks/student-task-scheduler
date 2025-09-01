<<<<<<< HEAD
import React from "react";
import { clsx } from "clsx";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string | boolean;
  maxLength?: number;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, maxLength, ...props }, ref) => {
    const base =
      "rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10";
    return (
      <textarea
        ref={ref}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        className={clsx(base, error && "border-red-500", className)}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
=======
import React from 'react';
import { clsx } from 'clsx';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string | boolean;
  maxLength?: number;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, maxLength, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        className={clsx(
          'rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10',
          error && 'border-red-500',
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';
>>>>>>> origin/codex/add-error-handling-and-character-counter

export default Textarea;
