'use client';

import React, { useMemo } from 'react';
import { Users, ArrowRight } from 'lucide-react';
import { BookingFee } from '@/types/fee';
import { Booking, bookingTotal } from '@/types/booking';
import { Detailer } from '@/types/detailer';
import { formatMoney } from '@/types/expense';
import { todayIso } from '@/lib/expenseOccurrences';

interface DetailerEarningsProps {
  /** Completed bookings inside the selected range. */
  completedInRange: Booking[];
  /** Every fee on the books, all time. */
  fees: BookingFee[];
  detailers: Detailer[];
  rangeLabel: string;
}

interface Row {
  id: string;
  name: string;
  active: boolean;
  /** In range. */
  jobs: number;
  collected: number;
  toAbsolute: number;
  kept: number;
  /** Jobs completed before the fee model - gross went to the business. */
  legacyJobs: number;
  legacyGross: number;
  /** All time. */
  owed: number;
  overdue: number;
}

/**
 * Where the money went, per detailer.
 *
 * Under the current model the detailer collects the whole amount and owes a
 * fixed booking fee, so for each of them: what they collected, what of that is
 * Absolute's, what they kept, and - regardless of the range - what they still
 * owe and how much of it is late.
 *
 * A job completed before the fee model has no fee row. The business collected
 * that money itself, so it is shown as "legacy" rather than pretending a
 * detailer kept it.
 */
export default function DetailerEarnings({ completedInRange, fees, detailers, rangeLabel }: DetailerEarningsProps) {
  const rows = useMemo<Row[]>(() => {
    const today = todayIso();
    const feeByBooking = new Map(fees.map((f) => [f.booking_id, f]));
    const byId = new Map<string, Row>();
    const ensure = (id: string, name: string, active: boolean) => {
      let r = byId.get(id);
      if (!r) {
        r = { id, name, active, jobs: 0, collected: 0, toAbsolute: 0, kept: 0, legacyJobs: 0, legacyGross: 0, owed: 0, overdue: 0 };
        byId.set(id, r);
      }
      return r;
    };
    detailers.forEach((d) => ensure(d.id, d.name, d.status === 'active'));

    completedInRange.forEach((b) => {
      if (!b.assigned_detailer_id) return;
      const r = ensure(b.assigned_detailer_id, b.assigned_detailer || 'Unknown', true);
      const fee = feeByBooking.get(b.id);
      if (fee) {
        r.jobs += 1;
        r.collected += fee.customer_total;
        r.toAbsolute += fee.fee_amount;
        r.kept += fee.customer_total - fee.fee_amount;
      } else {
        r.legacyJobs += 1;
        r.legacyGross += bookingTotal(b) || 0;
      }
    });

    fees.forEach((f) => {
      if (f.status !== 'owed') return;
      const r = ensure(f.detailer_id, f.detailer_name || 'Unknown', true);
      r.owed += f.fee_amount;
      if (f.due_on < today) r.overdue += f.fee_amount;
    });

    return Array.from(byId.values())
      .filter((r) => r.jobs > 0 || r.legacyJobs > 0 || r.owed > 0 || r.active)
      .sort((a, b) => b.owed - a.owed || b.toAbsolute - a.toAbsolute || a.name.localeCompare(b.name));
  }, [completedInRange, fees, detailers]);

  const totals = rows.reduce(
    (t, r) => ({
      jobs: t.jobs + r.jobs,
      collected: t.collected + r.collected,
      toAbsolute: t.toAbsolute + r.toAbsolute,
      kept: t.kept + r.kept,
      owed: t.owed + r.owed,
      overdue: t.overdue + r.overdue,
    }),
    { jobs: 0, collected: 0, toAbsolute: 0, kept: 0, owed: 0, overdue: 0 }
  );

  return (
    <section
      aria-label="Detailer earnings"
      className="bg-charcoal-card rounded-2xl p-4 sm:p-5 border border-charcoal-border/60 shadow-soft-sm space-y-4"
    >
      <div className="flex items-center gap-2 pb-3 border-b border-charcoal-border/40">
        <div className="w-8 h-8 rounded-xl bg-sage-100 text-sage-800 flex items-center justify-center shrink-0">
          <Users className="w-4 h-4 text-sage-700" />
        </div>
        <div>
          <h2 className="text-sm sm:text-base font-bold text-charcoal tracking-tight">Detailer earnings</h2>
          <p className="text-[11px] sm:text-xs text-charcoal-muted">
            Jobs, collected, share and fees are for {rangeLabel.toLowerCase()}. Owed and overdue are all time.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-charcoal-muted py-6 text-center">No detailer activity in this range.</p>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-muted border-b border-charcoal-border/40">
                <th className="text-left py-2 px-3 sm:px-2">Detailer</th>
                <th className="text-right py-2 px-2">Jobs</th>
                <th className="text-right py-2 px-2">Collected</th>
                <th className="text-right py-2 px-2">Their share</th>
                <th className="text-right py-2 px-2">To Absolute</th>
                <th className="text-right py-2 px-2">Owes now</th>
                <th className="text-right py-2 px-3 sm:px-2">Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-border/30">
              {rows.map((r) => (
                <tr key={r.id} className={r.active ? '' : 'opacity-60'}>
                  <td className="py-2.5 px-3 sm:px-2">
                    <span className="font-semibold text-charcoal">{r.name}</span>
                    {!r.active && <span className="ml-1.5 text-[10px] text-charcoal-muted">inactive</span>}
                    {r.legacyJobs > 0 && (
                      <span className="block text-[10px] text-charcoal-muted">
                        + {r.legacyJobs} pre-fee job{r.legacyJobs === 1 ? '' : 's'} · {formatMoney(r.legacyGross)} to the business
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-charcoal">{r.jobs}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-charcoal">{formatMoney(r.collected)}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-charcoal">{formatMoney(r.kept)}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums font-semibold text-sage-800">{formatMoney(r.toAbsolute)}</td>
                  <td className={`py-2.5 px-2 text-right tabular-nums font-semibold ${r.owed > 0 ? 'text-amber-700' : 'text-charcoal-muted'}`}>
                    {formatMoney(r.owed)}
                  </td>
                  <td className={`py-2.5 px-3 sm:px-2 text-right tabular-nums font-semibold ${r.overdue > 0 ? 'text-red-700' : 'text-charcoal-muted'}`}>
                    {r.overdue > 0 ? formatMoney(r.overdue) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-charcoal-border/60 font-bold text-charcoal">
                <td className="py-2.5 px-3 sm:px-2">Total</td>
                <td className="py-2.5 px-2 text-right tabular-nums">{totals.jobs}</td>
                <td className="py-2.5 px-2 text-right tabular-nums">{formatMoney(totals.collected)}</td>
                <td className="py-2.5 px-2 text-right tabular-nums">{formatMoney(totals.kept)}</td>
                <td className="py-2.5 px-2 text-right tabular-nums text-sage-800">{formatMoney(totals.toAbsolute)}</td>
                <td className={`py-2.5 px-2 text-right tabular-nums ${totals.owed > 0 ? 'text-amber-700' : ''}`}>{formatMoney(totals.owed)}</td>
                <td className={`py-2.5 px-3 sm:px-2 text-right tabular-nums ${totals.overdue > 0 ? 'text-red-700' : ''}`}>
                  {totals.overdue > 0 ? formatMoney(totals.overdue) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-charcoal-muted">
        <ArrowRight className="w-3 h-3" />
        Collected = what the customer paid the detailer in cash. To Absolute = the booking fee, which is our revenue on that job.
      </p>
    </section>
  );
}
