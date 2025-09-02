import React from "react";
import { clsx } from "clsx";

export type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "error" | "success" | "info";
};

export function Alert({ variant = "info", className, ...props }: AlertProps) {
  const variants = {
    error: "text-red-500",
    success: "text-green-500",
    info: "text-blue-500",
  } as const;

  return (
    <div
      role="alert"
      className={clsx(variants[variant], className)}
      {...props}
    />
  );
}
