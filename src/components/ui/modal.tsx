"use client";
import React from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-black/10 bg-white/90 p-4 shadow-2xl dark:border-white/10 dark:bg-neutral-900/90">
        {title && (
          <div className="mb-3 border-b border-black/10 pb-2 text-lg font-semibold dark:border-white/10">
            {title}
          </div>
        )}
        <div className="space-y-3">{children}</div>
        {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;

