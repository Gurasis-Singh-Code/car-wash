'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Booking } from '@/types/booking';
import { AlertTriangle, ArrowRight } from 'lucide-react';

/** How long a job may sit on the open board before it needs a human. */
const UNCLAIMED_AFTER_MINUTES = 120;

interface UnclaimedAlertProps {
  bookings: Booking[];
  /** Hidden on the page that already shows the unassigned queue. */
  showLink?: boolean;
}

/**
 * Jobs no detailer has taken.
 *
 * A booking made through Instagram now goes to every active detailer at once,
 * and the customer has already been told we will come back to them. If nobody
 * takes it, that promise is quietly broken — so after two hours it stops being
 * the detailers' problem and becomes yours.
 *
 * Renders nothing when there is nothing to say, so a healthy day shows no
 * banner at all.
 */
export default function UnclaimedAlert({ bookings, showLink = true }: UnclaimedAlertProps) {
  const overdue = useMemo(() => {
    const cutoff = Date.now() - UNCLAIMED_AFTER_MINUTES * 60 * 1000;
    const todayStr = new Date().toISOString().slice(0, 10);

    return bookings.filter((b) => {
      if (b.assigned_detailer_id) return false;
      if (b.status !== 'scheduled') return false;
      if (!b.offered_at) return false;
      // A job whose date has gone by cannot be claimed, so nagging about it is
      // noise rather than an alert.
      if (b.booking_date < todayStr) return false;
      return new Date(b.offered_at).getTime() <= cutoff;
    });
  }, [bookings]);

  if (overdue.length === 0) return null;

  const oldestHours = Math.floor(
    (Date.now() - new Date(overdue[0].offered_at as string).getTime()) / 3600000
  );

  return (
    <div className="p-3.5 sm:p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-3 animate-fade-in">
      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {overdue.length} job{overdue.length === 1 ? '' : 's'} still not taken by anyone
        </p>
        <p className="text-amber-800/90 mt-0.5">
          {overdue.length === 1 ? 'It has' : 'The oldest has'} been on the board for{' '}
          {oldestHours >= 24
            ? `${Math.floor(oldestHours / 24)} day${Math.floor(oldestHours / 24) === 1 ? '' : 's'}`
            : `${oldestHours} hour${oldestHours === 1 ? '' : 's'}`}
          . These customers were told we would confirm.
        </p>
      </div>
      {showLink && (
        <Link
          href="/admin"
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-charcoal-card border border-amber-300 text-amber-900 hover:bg-amber-100 transition-colors"
        >
          Assign
          <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}
