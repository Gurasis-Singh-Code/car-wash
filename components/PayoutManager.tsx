'use client';

import React, { useMemo, useState } from 'react';
import { Booking, SERVICE_LABELS } from '@/types/booking';
import { Detailer } from '@/types/detailer';
import { Payout, PayoutStatus, PAYOUT_STATUS_LABELS, PAYOUT_STATUS_STYLES } from '@/types/payout';
import { PayoutInput } from '@/lib/payouts';
import { formatMoney } from '@/types/expense';
import ConfirmModal from './ConfirmModal';
import { HandCoins, PlusCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react';

interface PayoutManagerProps {
  payouts: Payout[];
  detailers: Detailer[];
  bookings: Booking[];
  onAdd: (input: PayoutInput) => Promise<void>;
  onToggleStatus: (payout: Payout) => Promise<void>;
  onDelete: (payout: Payout) => Promise<void>;
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

/**
 * Records what each detailer is owed. This is what the Payments tab of the
 * detailer portal reads, and it is the only place those numbers come from.
 *
 * Nothing here is calculated for you. The amount is typed in every time, in
 * keeping with the existing rule that detailer pay is never derived from a
 * booking's price, and these entries are separate from the expenses below - so
 * recording a payout does not move the profit figures until the corresponding
 * wages expense is entered.
 */
export default function PayoutManager({
  payouts,
  detailers,
  bookings,
  onAdd,
  onToggleStatus,
  onDelete,
}: PayoutManagerProps) {
  const [detailerId, setDetailerId] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [amount, setAmount] = useState('');
  const [earnedOn, setEarnedOn] = useState(todayIso());
  const [status, setStatus] = useState<PayoutStatus>('pending');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Payout | null>(null);

  /**
   * Only the selected detailer's own completed jobs are offered, and only ones
   * they have not already been paid for - the database rejects a duplicate, so
   * offering it would just be a form that fails on submit.
   */
  const selectableBookings = useMemo(() => {
    if (!detailerId) return [];
    const alreadyPaid = new Set(
      payouts.filter((p) => p.detailer_id === detailerId).map((p) => p.booking_id)
    );
    return bookings
      .filter(
        (b) =>
          b.assigned_detailer_id === detailerId &&
          b.status === 'completed' &&
          !alreadyPaid.has(b.id)
      )
      .slice(0, 100);
  }, [bookings, payouts, detailerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!detailerId) {
      setError('Choose a detailer.');
      return;
    }

    const parsed = Number(amount);
    if (!amount.trim() || Number.isNaN(parsed) || parsed < 0) {
      setError('Enter an amount of 0 or more.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAdd({
        detailer_id: detailerId,
        booking_id: bookingId || null,
        amount: parsed,
        status,
        earned_on: earnedOn,
        notes,
      });
      setAmount('');
      setBookingId('');
      setNotes('');
    } catch (err: any) {
      setError(err?.message || 'Failed to record that payout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (payout: Payout) => {
    setBusyId(payout.id);
    try {
      await onToggleStatus(payout);
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

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-xl text-base sm:text-sm bg-canvas border border-charcoal-border focus:border-sage-500 text-charcoal focus:bg-charcoal-card transition-colors';
  const labelClass =
    'block text-xs font-semibold uppercase tracking-wider text-charcoal mb-1.5';

  return (
    <section className="bg-charcoal-card rounded-2xl p-4 sm:p-5 border border-charcoal-border/60 shadow-soft-sm space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-charcoal-border/40">
        <div className="w-8 h-8 rounded-xl bg-sage-100 text-sage-800 flex items-center justify-center shrink-0">
          <HandCoins className="w-4 h-4 text-sage-700" />
        </div>
        <div>
          <h2 className="text-sm sm:text-base font-bold text-charcoal tracking-tight">
            Detailer Payouts
          </h2>
          <p className="text-[11px] sm:text-xs text-charcoal-muted">
            What each detailer is owed. This is what they see in their portal.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="payout_detailer" className={labelClass}>
              Detailer <span className="text-red-500">*</span>
            </label>
            <select
              id="payout_detailer"
              value={detailerId}
              onChange={(e) => {
                setDetailerId(e.target.value);
                setBookingId('');
                if (error) setError(null);
              }}
              className={inputClass}
            >
              <option value="">Select a detailer</option>
              {detailers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="payout_amount" className={labelClass}>
              Amount <span className="text-red-500">*</span>
            </label>
            <input
              id="payout_amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (error) setError(null);
              }}
              placeholder="0.00"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="payout_booking" className={labelClass}>
            For which job
          </label>
          <select
            id="payout_booking"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            disabled={!detailerId}
            className={`${inputClass} disabled:opacity-50`}
          >
            <option value="">No specific job (bonus, tip or correction)</option>
            {selectableBookings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.booking_date} · {SERVICE_LABELS[b.service] || b.service} · {b.customer_name}
              </option>
            ))}
          </select>
          {detailerId && selectableBookings.length === 0 && (
            <p className="text-[11px] text-charcoal-muted mt-1">
              No unpaid completed jobs for this detailer.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="payout_date" className={labelClass}>
              Earned on
            </label>
            <input
              id="payout_date"
              type="date"
              value={earnedOn}
              onChange={(e) => setEarnedOn(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="payout_status" className={labelClass}>
              Status
            </label>
            <select
              id="payout_status"
              value={status}
              onChange={(e) => setStatus(e.target.value as PayoutStatus)}
              className={inputClass}
            >
              <option value="pending">Pending — not paid out yet</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="payout_notes" className={labelClass}>
            Note
          </label>
          <input
            id="payout_notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional — the detailer sees this"
            className={inputClass}
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 flex items-start gap-1">
            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" /> {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-sage-500 hover:bg-sage-600 active:scale-[0.99] text-white dark:text-charcoal-card text-xs sm:text-sm font-semibold rounded-xl shadow-soft-sm transition-all disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <PlusCircle className="w-4 h-4" />
          )}
          <span>Record Payout</span>
        </button>
      </form>

      {payouts.length === 0 ? (
        <p className="text-xs text-charcoal-muted py-3 text-center">
          No payouts recorded yet.
        </p>
      ) : (
        <div className="space-y-2">
          {payouts.slice(0, 40).map((p) => {
            const isBusy = busyId === p.id;
            return (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border border-charcoal-border/60 bg-canvas"
              >
                <span className="font-semibold text-sm text-charcoal">{p.detailer_name}</span>
                <span className="text-xs text-charcoal-muted truncate min-w-0">
                  {p.booking_label || p.notes || 'Adjustment'}
                </span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${PAYOUT_STATUS_STYLES[p.status]}`}
                >
                  {PAYOUT_STATUS_LABELS[p.status]}
                </span>
                <span className="text-[11px] text-charcoal-muted">{p.earned_on}</span>

                <div className="flex items-center gap-2 ml-auto">
                  <span className="font-bold text-sm text-charcoal tabular-nums">
                    {formatMoney(p.amount)}
                  </span>
                  {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin text-sage-600" />}
                  <button
                    type="button"
                    onClick={() => handleToggle(p)}
                    disabled={isBusy}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-charcoal-muted hover:text-charcoal bg-charcoal-card hover:bg-sage-50 border border-charcoal-border/60 transition-colors disabled:opacity-50"
                  >
                    {p.status === 'paid' ? 'Mark pending' : 'Mark paid'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(p)}
                    disabled={isBusy}
                    className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 active:scale-95 rounded-lg border border-red-200/60 transition-all disabled:opacity-50"
                    aria-label="Delete payout"
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
        title="Delete Payout"
        message={
          deleting
            ? `Delete the ${formatMoney(deleting.amount)} payout for ${deleting.detailer_name}? It disappears from their Payments tab.`
            : ''
        }
        confirmLabel="Delete Payout"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
}
