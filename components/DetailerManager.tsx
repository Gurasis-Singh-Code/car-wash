'use client';

import React, { useState } from 'react';
import { Detailer, DETAILER_STATUS_LABELS, DETAILER_STATUS_STYLES } from '@/types/detailer';
import { UserCheck, PlusCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

interface DetailerManagerProps {
  detailers: Detailer[];
  assignedCounts: Record<string, number>;
  onAdd: (name: string) => Promise<void>;
  onToggleStatus: (detailer: Detailer) => Promise<void>;
  onDelete: (detailer: Detailer) => Promise<void>;
}

/**
 * Create and manage detailers. Deliberately minimal: a name is the only thing
 * required, matching how the rest of the panel treats optional detail.
 */
export default function DetailerManager({
  detailers,
  assignedCounts,
  onAdd,
  onToggleStatus,
  onDelete,
}: DetailerManagerProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Detailer | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Detailer name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAdd(name.trim());
      setName('');
    } catch (err: any) {
      setError(err?.message || 'Failed to add detailer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (detailer: Detailer) => {
    setBusyId(detailer.id);
    try {
      await onToggleStatus(detailer);
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    setBusyId(target.id);
    try {
      await onDelete(target);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-charcoal-card rounded-2xl p-4 sm:p-5 border border-charcoal-border/60 shadow-soft-sm space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-charcoal-border/40">
        <div className="w-8 h-8 rounded-xl bg-sage-100 text-sage-800 flex items-center justify-center shrink-0">
          <UserCheck className="w-4 h-4 text-sage-700" />
        </div>
        <div>
          <h2 className="text-sm sm:text-base font-bold text-charcoal tracking-tight">Detailers</h2>
          <p className="text-[11px] sm:text-xs text-charcoal-muted">
            Add your team, then assign them to bookings below.
          </p>
        </div>
      </div>

      {/* Add form: name is the only field */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <label
          htmlFor="detailer_name"
          className="block text-xs font-semibold uppercase tracking-wider text-charcoal"
        >
          Detailer Name <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="detailer_name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Manmohit"
            className={`flex-1 px-3.5 py-2.5 rounded-xl text-base sm:text-sm bg-canvas border ${
              error ? 'border-red-400 focus:border-red-500' : 'border-charcoal-border focus:border-sage-500'
            } text-charcoal focus:bg-charcoal-card transition-colors`}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-sage-500 hover:bg-sage-600 active:scale-[0.99] text-white dark:text-charcoal-card text-xs sm:text-sm font-semibold rounded-xl shadow-soft-sm transition-all disabled:opacity-50 shrink-0"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <PlusCircle className="w-4 h-4" />
            )}
            <span>Add Detailer</span>
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" /> {error}
          </p>
        )}
      </form>

      {/* Roster */}
      {detailers.length === 0 ? (
        <p className="text-xs text-charcoal-muted py-3 text-center">
          No detailers yet. Add one above to start assigning bookings.
        </p>
      ) : (
        <div className="space-y-2">
          {detailers.map((d) => {
            const isBusy = busyId === d.id;
            const count = assignedCounts[d.id] || 0;
            return (
              <div
                key={d.id}
                className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border border-charcoal-border/60 bg-canvas"
              >
                <span className="font-semibold text-sm text-charcoal truncate min-w-0">{d.name}</span>

                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${DETAILER_STATUS_STYLES[d.status]}`}
                >
                  {DETAILER_STATUS_LABELS[d.status]}
                </span>

                <span className="text-[11px] text-charcoal-muted">
                  {count} {count === 1 ? 'booking' : 'bookings'}
                </span>

                <div className="flex items-center gap-2 ml-auto">
                  {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin text-sage-600" />}
                  <button
                    type="button"
                    onClick={() => handleToggle(d)}
                    disabled={isBusy}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-charcoal-muted hover:text-charcoal bg-charcoal-card hover:bg-sage-50 border border-charcoal-border/60 transition-colors disabled:opacity-50"
                    title={
                      d.status === 'active'
                        ? 'Hide from the assignment dropdown'
                        : 'Show in the assignment dropdown again'
                    }
                  >
                    {d.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(d)}
                    disabled={isBusy}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 active:scale-95 rounded-lg border border-red-200/60 transition-all disabled:opacity-50"
                    aria-label={`Delete detailer ${d.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleting)}
        title="Delete Detailer"
        message={
          deleting
            ? `Delete ${deleting.name}? Their ${assignedCounts[deleting.id] || 0} assigned booking(s) are not deleted — they return to the Unassigned queue.`
            : ''
        }
        confirmLabel="Delete Detailer"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
