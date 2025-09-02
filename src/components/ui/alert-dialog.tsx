import React from 'react';
import { Button } from './button';

interface AlertDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AlertDialog({
  open,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmDisabled,
  onConfirm,
  onCancel,
}: AlertDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-sm rounded bg-card p-6 shadow-lg"
      >
        {title && <h2 className="text-lg font-semibold">{title}</h2>}
        {description && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{description}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button variant="danger" disabled={confirmDisabled} onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AlertDialog;

