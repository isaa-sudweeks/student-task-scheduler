import React from 'react';
import { clsx } from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded px-4 py-2 text-sm font-medium focus:outline-none disabled:opacity-60';
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-black text-white dark:bg-white dark:text-black',
    secondary:
      'bg-gray-100 text-gray-900 border border-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700',
    danger: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700',
  };

  return (
    <button className={clsx(base, variants[variant], className)} {...props} />
  );
}

export default Button;
