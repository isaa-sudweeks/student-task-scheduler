import React from 'react';
import { clsx } from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string | boolean;
  maxLength?: number;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, maxLength, ...props }, ref) => {
    return (
      <input
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
Input.displayName = 'Input';

export default Input;
