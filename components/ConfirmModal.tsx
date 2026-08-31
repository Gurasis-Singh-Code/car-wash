'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = true,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-charcoal/40 dark:bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-charcoal-card w-full max-w-md rounded-2xl p-5 sm:p-6 shadow-soft-lg border border-charcoal-border animate-scale-up"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4 mb-3 sm:mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isDestructive ? 'bg-red-50 text-red-600' : 'bg-sage-100 text-sage-700'
              }`}
            >
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-charcoal">{title}</h3>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-charcoal-muted hover:text-charcoal p-1 rounded-lg hover:bg-sage-50 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-charcoal-muted mb-5 sm:mb-6 leading-relaxed">
          {message}
        </p>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 sm:py-2 text-xs sm:text-sm font-medium text-charcoal-muted hover:text-charcoal bg-sage-50/80 hover:bg-sage-100 rounded-xl transition-colors text-center"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2.5 sm:py-2 text-xs sm:text-sm font-semibold text-white rounded-xl shadow-soft-sm transition-all text-center ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700 active:scale-98'
                : 'bg-sage-500 hover:bg-sage-600 active:scale-98'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
