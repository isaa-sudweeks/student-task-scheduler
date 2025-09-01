import React from "react";
import { clsx } from "clsx";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string | boolean;
  maxLength?: number;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, maxLength, ...props }, ref) => (
    <input
      ref={ref}
      maxLength={maxLength}
      aria-invalid={error ? true : undefined}
      className={clsx(
        "h-9 w-full rounded-md border border-black/10 bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10",
        error && "border-red-500",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export default Input;
