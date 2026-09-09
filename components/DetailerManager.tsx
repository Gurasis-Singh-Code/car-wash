'use client';

import React, { useState } from 'react';
import { Detailer, DETAILER_STATUS_LABELS, DETAILER_STATUS_STYLES } from '@/types/detailer';
import {
  Availability,
  DayOfWeek,
  DAYS_OF_WEEK,
  DAY_SHORT_LABELS,
  formatScheduleTime,
} from '@/types/availability';
import {
  UserCheck,
  PlusCircle,
  AlertCircle,
  Loader2,
  Trash2,
  KeyRound,
  Link2Off,
  CalendarClock,
  ChevronDown,
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

interface DetailerManagerProps {
  detailers: Detailer[];
  assignedCounts: Record<string, number>;
  /**
   * Weekly hours per detailer, set by them in the detailer portal. Read-only
   * here, and deliberately not consulted when assigning work.
   */
  availability: Record<string, Partial<Record<DayOfWeek, Availability>>>;
  onAdd: (name: string) => Promise<void>;
  onToggleStatus: (detailer: Detailer) => Promise<void>;
  onDelete: (detailer: Detailer) => Promise<void>;
  onLinkLogin: (detailer: Detailer, email: string) => Promise<void>;
  onUnlinkLogin: (detailer: Detailer) => Promise<void>;
}

/**
 * Create and manage detailers. Deliberately minimal: a name is the only thing
 * required, matching how the rest of the panel treats optional detail.
 */
export default function DetailerManager({
  detailers,
  assignedCounts,
  availability,
  onAdd,
  onToggleStatus,
  onDelete,
  onLinkLogin,
  onUnlinkLogin,
}: DetailerManagerProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Detailer | null>(null);

  // Which roster row has its "link a login" field open, and what is typed in it.
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  // Which roster row has its weekly hours expanded. Collapsed by default so the
  // roster stays as short as it was before this existed.
  const [openScheduleId, setOpenScheduleId] = useState<string | null>(null);

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

  const handleLink = async (detailer: Detailer) => {
    setLinkError(null);
    if (!linkEmail.trim()) {
      setLinkError('Enter the email of the account you created in Supabase.');
      return;
    }

    setBusyId(detailer.id);
    try {
      await onLinkLogin(detailer, linkEmail.trim());
      setLinkingId(null);
      setLinkEmail('');
    } catch (err: any) {
      setLinkError(err?.message || 'Could not link that login.');
    } finally {
      setBusyId(null);
    }
  };

  const handleUnlink = async (detailer: Detailer) => {
    setBusyId(detailer.id);
    try {
      await onUnlinkLogin(detailer);
    } catch (err: any) {
      setLinkError(err?.message || 'Could not unlink that login.');
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
            Add your team, assign them to bookings below, and give them a portal login.
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
            const schedule = availability[d.id] || {};
            const daysSet = DAYS_OF_WEEK.filter((day) => schedule[day]).length;
            const isScheduleOpen = openScheduleId === d.id;
            return (
              <div
                key={d.id}
                className="p-2.5 rounded-xl border border-charcoal-border/60 bg-canvas space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2">
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

                {/* Portal login. The account itself is created in the Supabase
                    dashboard - that is the only place a password can be set
                    without it passing through this app - and linked here. */}
                <div className="pt-2 border-t border-charcoal-border/40">
                  {d.auth_user_id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sage-100 text-sage-800 border border-sage-200/80">
                        <KeyRound className="w-3 h-3 text-sage-700" />
                        Portal login
                      </span>
                      <span className="text-[11px] text-charcoal-muted truncate min-w-0">{d.email}</span>
                      <button
                        type="button"
                        onClick={() => handleUnlink(d)}
                        disabled={isBusy}
                        className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-charcoal-muted hover:text-charcoal bg-charcoal-card hover:bg-sage-50 border border-charcoal-border/60 transition-colors disabled:opacity-50"
                        title="Revoke portal access. Their bookings and payouts are untouched."
                      >
                        <Link2Off className="w-3 h-3" />
                        Unlink
                      </button>
                    </div>
                  ) : linkingId === d.id ? (
                    <div className="space-y-1.5">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="email"
                          value={linkEmail}
                          onChange={(e) => {
                            setLinkEmail(e.target.value);
                            if (linkError) setLinkError(null);
                          }}
                          placeholder="login email from Supabase Auth"
                          className="flex-1 px-3 py-2 rounded-lg text-base sm:text-xs bg-charcoal-card border border-charcoal-border focus:border-sage-500 text-charcoal transition-colors"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleLink(d)}
                            disabled={isBusy}
                            className="px-3 py-2 rounded-lg text-xs font-semibold bg-sage-500 hover:bg-sage-600 text-white dark:text-charcoal-card transition-colors disabled:opacity-50"
                          >
                            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Link'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLinkingId(null);
                              setLinkError(null);
                            }}
                            className="px-3 py-2 rounded-lg text-xs font-semibold text-charcoal-muted hover:text-charcoal border border-charcoal-border/60 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                      {linkError && (
                        <p className="text-[11px] text-red-600 flex items-start gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" /> {linkError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setLinkingId(d.id);
                        setLinkEmail('');
                        setLinkError(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-charcoal-muted hover:text-charcoal bg-charcoal-card hover:bg-sage-50 border border-charcoal-border/60 transition-colors"
                    >
                      <KeyRound className="w-3 h-3" />
                      Link a portal login
                    </button>
                  )}
                </div>

                {/* Weekly hours, set by the detailer in their own app. Shown
                    here read-only: there is no edit control, and nothing on
                    this page consults it when assigning work. */}
                <div className="pt-2 border-t border-charcoal-border/40">
                  <button
                    type="button"
                    onClick={() => setOpenScheduleId(isScheduleOpen ? null : d.id)}
                    aria-expanded={isScheduleOpen}
                    className="w-full flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-charcoal-muted hover:text-charcoal bg-charcoal-card hover:bg-sage-50 border border-charcoal-border/60 transition-colors"
                  >
                    <CalendarClock className="w-3 h-3 shrink-0" />
                    <span>Weekly hours</span>
                    <span className="text-charcoal-muted font-medium">
                      {daysSet === 0
                        ? '· not set yet'
                        : `· ${daysSet} ${daysSet === 1 ? 'day' : 'days'}`}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 ml-auto shrink-0 transition-transform ${isScheduleOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isScheduleOpen && (
                    <dl className="mt-2 rounded-lg border border-charcoal-border/50 divide-y divide-charcoal-border/40 overflow-hidden">
                      {DAYS_OF_WEEK.map((day) => {
                        const slot = schedule[day];
                        return (
                          <div
                            key={day}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-charcoal-card"
                          >
                            <dt className="text-[11px] font-semibold text-charcoal w-10 shrink-0">
                              {DAY_SHORT_LABELS[day]}
                            </dt>
                            <dd
                              className={`text-[11px] tabular-nums ${slot ? 'text-charcoal' : 'text-charcoal-muted'}`}
                            >
                              {slot
                                ? `${formatScheduleTime(slot.start_time)} – ${formatScheduleTime(slot.end_time)}`
                                : 'Not working'}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  )}
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
