'use client';

import React, { useMemo, useState } from 'react';
import { HandCoins, Check, Undo2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { BookingFee, FEE_STATUS_STYLES } from '@/types/fee';
import { DetailerWeek, groupByDetailerWeek } from '@/lib/fees';
import { formatMoney } from '@/types/expense';
import { SERVICE_LABELS } from '@/types/booking';

interface FeeManagerProps {
  fees: BookingFee[];
  onMarkPaid: (detailerId: string, weekStart: string) => Promise<void>;
  onMarkOwed: (detailerId: string, weekStart: string) => Promise<void>;
}

/** "15–21 Sep" for a Monday-start YYYY-MM-DD. */
function weekLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const s = start.toLocaleDateString('en-CA', { day: 'numeric', month: sameMonth ? undefined : 'short' });
  const e = end.toLocaleDateString('en-CA', { day: 'numeric', month: 'short' });
  return `${s}–${e}`;
}

/**
 * Booking fees owed by detailers, one row per detailer per week.
 *
 * Nothing here is typed in. The fee rows are written by the database when a
 * job is marked completed; this is where the office records that the
 * e-transfer for a week has arrived. Marking a week paid is reversible.
 */
export default function FeeManager({ fees, onMarkPaid, onMarkOwed }: FeeManagerProps) {
  const weeks = useMemo(() => groupByDetailerWeek(fees), [fees]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const totalOwed = fees.filter((f) => f.status === 'owed').reduce((s, f) => s + f.fee_amount, 0);
  const totalOverdue = weeks.filter((w) => w.overdue).reduce((s, w) => s + w.owed, 0);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusyKey(key);
    try {
      await fn();
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section
      aria-label="Booking fees"
      className="bg-charcoal-card rounded-2xl p-4 sm:p-5 border border-charcoal-border/60 shadow-soft-sm space-y-4"
    >
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-charcoal-border/40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sage-100 text-sage-800 flex items-center justify-center shrink-0">
            <HandCoins className="w-4 h-4 text-sage-700" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-charcoal tracking-tight">Booking fees</h2>
            <p className="text-[11px] sm:text-xs text-charcoal-muted">
              What each detailer owes, by week. Mark a week paid when the e-transfer lands.
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-muted">Outstanding</p>
          <p className={`text-lg font-bold tabular-nums ${totalOverdue > 0 ? 'text-red-700' : totalOwed > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {formatMoney(totalOwed)}
          </p>
          {totalOverdue > 0 && (
            <p className="text-[11px] font-semibold text-red-700">{formatMoney(totalOverdue)} overdue</p>
          )}
        </div>
      </div>

      {weeks.length === 0 ? (
        <p className="text-xs text-charcoal-muted py-6 text-center">
          No fees yet. A row appears here the moment a detailer marks a job done.
        </p>
      ) : (
        <ul className="space-y-2">
          {weeks.map((w) => {
            const key = `${w.detailer_id}|${w.week_start}`;
            const settled = w.owed === 0;
            const busy = busyKey === key;
            const open = openKey === key;
            return (
              <li key={key} className="rounded-xl border border-charcoal-border/60 bg-canvas">
                <div className="flex items-center gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => setOpenKey(open ? null : key)}
                    className="flex-1 min-w-0 text-left flex items-center gap-2"
                    aria-expanded={open}
                  >
                    {open ? <ChevronUp className="w-4 h-4 text-charcoal-muted shrink-0" /> : <ChevronDown className="w-4 h-4 text-charcoal-muted shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-charcoal truncate">
                        {w.detailer_name} · week of {weekLabel(w.week_start)}
                      </p>
                      <p className="text-[11px] text-charcoal-muted">
                        {w.fees.length} job{w.fees.length === 1 ? '' : 's'} · they collected {formatMoney(w.collected)}
                        {!settled && (
                          <span className={w.overdue ? ' font-semibold text-red-700' : ''}>
                            {' '}· {w.overdue ? 'overdue since' : 'due'} {w.due_on}
                          </span>
                        )}
                      </p>
                    </div>
                  </button>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular-nums text-charcoal">{formatMoney(w.owed + w.paid)}</p>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${settled ? FEE_STATUS_STYLES.paid : w.overdue ? 'bg-red-50 text-red-700 border-red-200/60' : FEE_STATUS_STYLES.owed}`}>
                      {settled ? 'Paid' : w.overdue ? `${formatMoney(w.owed)} overdue` : `${formatMoney(w.owed)} owed`}
                    </span>
                  </div>

                  {settled ? (
                    <button
                      type="button"
                      onClick={() => run(key, () => onMarkOwed(w.detailer_id, w.week_start))}
                      disabled={busy}
                      title="Undo - mark this week as still owed"
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-charcoal-muted bg-charcoal-surface hover:bg-charcoal-border/40 border border-charcoal-border/50 transition-colors disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => run(key, () => onMarkPaid(w.detailer_id, w.week_start))}
                      disabled={busy}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-sage-600 hover:bg-sage-700 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Mark paid
                    </button>
                  )}
                </div>

                {open && (
                  <ul className="border-t border-charcoal-border/40 divide-y divide-charcoal-border/30">
                    {w.fees.map((f) => (
                      <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
                        <span className="min-w-0 truncate text-charcoal">
                          {f.completed_on} · {SERVICE_LABELS[f.service] || f.service}
                          {f.customer_name ? ` · ${f.customer_name}` : ''}
                          <span className="text-charcoal-muted">
                            {' '}· collected {formatMoney(f.customer_total)}
                            {f.pet_hair_fee > 0 ? ` · incl. ${formatMoney(f.pet_hair_fee)} pet hair` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-charcoal">{formatMoney(f.fee_amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
