'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Booking, SERVICE_LOCATION_LABELS } from '@/types/booking';
import { Expense, EXPENSE_TYPE_LABELS, formatMoney } from '@/types/expense';
import { getBookings, subscribeToBookings } from '@/lib/bookings';
import {
  getExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  subscribeToExpenses,
  existingCategories,
  ExpenseInput,
} from '@/lib/expenses';
import { Detailer } from '@/types/detailer';
import { Payout, PayoutStatus } from '@/types/payout';
import { getDetailers } from '@/lib/detailers';
import {
  getPayouts,
  addPayout,
  updatePayoutStatus,
  deletePayout,
  PayoutInput,
} from '@/lib/payouts';
import { useAuth } from '@/components/AuthProvider';
import ExpenseManager from '@/components/ExpenseManager';
import PayoutManager from '@/components/PayoutManager';
import {
  Wallet,
  RefreshCw,
  AlertCircle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Truck,
  Store,
  BarChart3,
  PieChart,
} from 'lucide-react';

type Period = 'week' | 'month';

/** Monday-based week key, matching how the rest of the panel treats weeks. */
function weekKey(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay();
  dt.setDate(dt.getDate() + (dow === 0 ? -6 : 1 - dow));
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function periodKey(dateStr: string, period: Period): string {
  return period === 'week' ? weekKey(dateStr) : monthKey(dateStr);
}

function periodLabel(key: string, period: Period): string {
  if (period === 'month') {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface PeriodRow {
  key: string;
  label: string;
  revenueMobile: number;
  revenueShop: number;
  expenseMobile: number;
  expenseShop: number;
  expenseShared: number;
}

export default function FinancePage() {
  const { isConfigured } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [detailers, setDetailers] = useState<Detailer[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [period, setPeriod] = useState<Period>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [b, e, d, p] = await Promise.all([
        getBookings(),
        getExpenses(),
        getDetailers(),
        getPayouts(),
      ]);
      setBookings(b);
      setExpenses(e);
      setDetailers(d);
      setPayouts(p);
    } catch (err: any) {
      console.error('[FinancePage loadData error]:', err);
      setError(err?.message || 'Failed to load finance data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubBookings = subscribeToBookings(() => loadData());
    const unsubExpenses = subscribeToExpenses(() => loadData());
    return () => {
      unsubBookings();
      unsubExpenses();
    };
  }, [loadData]);

  /**
   * Revenue counts COMPLETED bookings only — money actually earned. Scheduled
   * work is pipeline, and cancelled bookings still carry a price, so including
   * either would inflate profit against real expenses.
   */
  const earned = useMemo(
    () => bookings.filter((b) => b.status === 'completed' && b.price != null),
    [bookings]
  );

  const rows: PeriodRow[] = useMemo(() => {
    const map = new Map<string, PeriodRow>();
    const ensure = (key: string) => {
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: periodLabel(key, period),
          revenueMobile: 0,
          revenueShop: 0,
          expenseMobile: 0,
          expenseShop: 0,
          expenseShared: 0,
        });
      }
      return map.get(key)!;
    };

    earned.forEach((b) => {
      const row = ensure(periodKey(b.booking_date, period));
      const amount = Number(b.price) || 0;
      if ((b.service_location || 'mobile') === 'shop') row.revenueShop += amount;
      else row.revenueMobile += amount;
    });

    expenses.forEach((e) => {
      const row = ensure(periodKey(e.date, period));
      if (e.service_location === 'shop') row.expenseShop += e.amount;
      else if (e.service_location === 'mobile') row.expenseMobile += e.amount;
      else row.expenseShared += e.amount;
    });

    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key)).slice(-12);
  }, [earned, expenses, period]);

  const totals = useMemo(() => {
    const t = {
      revenueMobile: 0,
      revenueShop: 0,
      expenseMobile: 0,
      expenseShop: 0,
      expenseShared: 0,
      expenseFixed: 0,
      expenseVariable: 0,
    };
    rows.forEach((r) => {
      t.revenueMobile += r.revenueMobile;
      t.revenueShop += r.revenueShop;
      t.expenseMobile += r.expenseMobile;
      t.expenseShop += r.expenseShop;
      t.expenseShared += r.expenseShared;
    });
    // Fixed / variable split is drawn from the same window the rows cover.
    const windowKeys = new Set(rows.map((r) => r.key));
    expenses.forEach((e) => {
      if (!windowKeys.has(periodKey(e.date, period))) return;
      if (e.type === 'fixed') t.expenseFixed += e.amount;
      else t.expenseVariable += e.amount;
    });
    return t;
  }, [rows, expenses, period]);

  const revenueTotal = totals.revenueMobile + totals.revenueShop;
  const expenseTotal = totals.expenseMobile + totals.expenseShop + totals.expenseShared;
  const profitTotal = revenueTotal - expenseTotal;
  // Per-location profit subtracts only that location's own expenses. Shared
  // overhead is deliberately NOT apportioned — it is reported on its own line.
  const profitMobile = totals.revenueMobile - totals.expenseMobile;
  const profitShop = totals.revenueShop - totals.expenseShop;

  const categoryBreakdown = useMemo(() => {
    const windowKeys = new Set(rows.map((r) => r.key));
    const map = new Map<string, number>();
    expenses.forEach((e) => {
      if (!windowKeys.has(periodKey(e.date, period))) return;
      const k = e.category.trim() || 'Uncategorised';
      map.set(k, (map.get(k) || 0) + e.amount);
    });
    const items = Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
    const max = items.reduce((m, i) => Math.max(m, i.amount), 0);
    return { items, max };
  }, [expenses, rows, period]);

  // Bars are scaled against the largest revenue-or-expense value in the window.
  const chartMax = useMemo(
    () =>
      rows.reduce(
        (m, r) =>
          Math.max(
            m,
            r.revenueMobile + r.revenueShop,
            r.expenseMobile + r.expenseShop + r.expenseShared
          ),
        0
      ),
    [rows]
  );

  const categories = useMemo(() => existingCategories(expenses), [expenses]);

  // Payouts sort by earning date, so a backdated entry has to be re-sorted
  // rather than simply prepended.
  const handleAddPayout = async (input: PayoutInput) => {
    const created = await addPayout(input);
    setPayouts((prev) =>
      [created, ...prev].sort((a, b) => (a.earned_on < b.earned_on ? 1 : -1))
    );
  };

  const handleTogglePayoutStatus = async (payout: Payout) => {
    const next: PayoutStatus = payout.status === 'paid' ? 'pending' : 'paid';
    const previous = [...payouts];
    setPayouts((prev) => prev.map((p) => (p.id === payout.id ? { ...p, status: next } : p)));
    try {
      const updated = await updatePayoutStatus(payout.id, next);
      setPayouts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err: any) {
      setPayouts(previous);
      setError(err?.message || 'Failed to update that payout.');
    }
  };

  const handleDeletePayout = async (payout: Payout) => {
    const previous = [...payouts];
    setPayouts((prev) => prev.filter((p) => p.id !== payout.id));
    try {
      await deletePayout(payout.id);
    } catch (err: any) {
      setPayouts(previous);
      setError(err?.message || 'Failed to delete that payout.');
    }
  };

  const handleAdd = async (data: ExpenseInput) => {
    const created = await addExpense(data);
    setExpenses((prev) => [created, ...prev]);
  };
  const handleUpdate = async (id: string, data: ExpenseInput) => {
    const updated = await updateExpense(id, data);
    setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
  };
  const handleDelete = async (id: string) => {
    const previous = [...expenses];
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    try {
      await deleteExpense(id);
    } catch (err: any) {
      setExpenses(previous);
      throw err;
    }
  };

  const statCards = [
    {
      title: 'Revenue · Mobile',
      value: formatMoney(totals.revenueMobile),
      note: 'Completed mobile jobs',
      icon: Truck,
    },
    {
      title: 'Revenue · Shop',
      value: formatMoney(totals.revenueShop),
      note: 'Completed in-shop jobs',
      icon: Store,
    },
    {
      title: 'Expenses',
      value: formatMoney(expenseTotal),
      note: `${formatMoney(totals.expenseFixed)} fixed · ${formatMoney(totals.expenseVariable)} variable`,
      icon: TrendingDown,
    },
    {
      title: 'Profit',
      value: formatMoney(profitTotal),
      note: 'Revenue minus all expenses',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-2 border-b border-charcoal-border/40">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-charcoal">Finance</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-sage-100 text-sage-800">
              <Wallet className="w-3 h-3 text-sage-600" />
              Revenue &amp; Expenses
            </span>
          </div>
          <p className="text-xs sm:text-sm text-charcoal-muted mt-0.5 sm:mt-1">
            Revenue counts completed jobs only. Expenses are entered manually.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => loadData()}
            className="p-2.5 rounded-xl border border-charcoal-border/60 bg-charcoal-card hover:bg-sage-50 text-charcoal-muted hover:text-charcoal shadow-soft-sm transition-colors shrink-0"
            title="Refresh Finance Data"
            aria-label="Refresh Finance Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sage-600' : ''}`} />
          </button>

          {/* Week / Month toggle */}
          <div className="flex items-center gap-1.5 p-1 bg-canvas border border-charcoal-border/70 rounded-xl">
            {(['week', 'month'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  period === p
                    ? 'bg-sage-600 text-white dark:text-charcoal-card shadow-soft-xs'
                    : 'text-charcoal-muted hover:text-charcoal hover:bg-charcoal-card'
                }`}
              >
                {p === 'week' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!isConfigured && (
        <div className="p-4 rounded-xl bg-sage-50/80 border border-sage-200 text-charcoal text-xs flex items-start gap-3">
          <div className="w-6 h-6 rounded-lg bg-sage-200/80 text-sage-800 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="font-semibold text-charcoal">Supabase Live Connection Ready</p>
            <p className="text-charcoal-muted mt-0.5">
              Add your credentials in <code className="font-mono bg-charcoal-card px-1 py-0.5 rounded border border-sage-200">.env.local</code> to load live finance data.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Headline figures */}
      <section aria-label="Finance Summary">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="bg-charcoal-card rounded-xl p-3.5 sm:p-5 border border-charcoal-border/60 shadow-soft-sm hover:shadow-soft-md transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
                    {card.title}
                  </span>
                  <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-sage-50 text-sage-600 flex items-center justify-center border border-sage-100 shrink-0">
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                  <span className="text-xl sm:text-3xl font-bold tracking-tight text-charcoal">
                    {card.value}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-charcoal-muted/80 line-clamp-2">
                  {card.note}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Profit by location */}
      <section
        aria-label="Profit by Location"
        className="bg-charcoal-card rounded-2xl p-4 sm:p-5 border border-charcoal-border/60 shadow-soft-sm space-y-3.5"
      >
        <div className="flex items-center gap-2 pb-3 border-b border-charcoal-border/40">
          <div className="w-8 h-8 rounded-xl bg-sage-100 text-sage-800 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4 text-sage-700" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-charcoal tracking-tight">
              Profit by Location
            </h2>
            <p className="text-[11px] sm:text-xs text-charcoal-muted">
              Each location carries only its own tagged expenses. Shared overhead is listed
              separately and counted once in the combined figure.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              label: SERVICE_LOCATION_LABELS.mobile,
              revenue: totals.revenueMobile,
              expense: totals.expenseMobile,
              profit: profitMobile,
              icon: Truck,
            },
            {
              label: SERVICE_LOCATION_LABELS.shop,
              revenue: totals.revenueShop,
              expense: totals.expenseShop,
              profit: profitShop,
              icon: Store,
            },
          ].map((loc) => {
            const Icon = loc.icon;
            return (
              <div key={loc.label} className="rounded-xl border border-charcoal-border/60 bg-canvas p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-charcoal-muted">
                  <Icon className="w-3.5 h-3.5 text-sage-600" />
                  <span>{loc.label}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-charcoal-muted">Revenue</span>
                  <span className="font-semibold text-charcoal">{formatMoney(loc.revenue)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-charcoal-muted">Expenses</span>
                  <span className="font-semibold text-charcoal">−{formatMoney(loc.expense)}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-1.5 border-t border-charcoal-border/40">
                  <span className="font-semibold text-charcoal">Profit</span>
                  <span
                    className={`font-bold ${loc.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                  >
                    {formatMoney(loc.profit)}
                  </span>
                </div>
              </div>
            );
          })}

          <div className="rounded-xl border border-charcoal-border/60 bg-canvas p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-charcoal-muted">
              <Wallet className="w-3.5 h-3.5 text-sage-600" />
              <span>Combined</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-charcoal-muted">Revenue</span>
              <span className="font-semibold text-charcoal">{formatMoney(revenueTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-charcoal-muted">Shared overhead</span>
              <span className="font-semibold text-charcoal">−{formatMoney(totals.expenseShared)}</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-1.5 border-t border-charcoal-border/40">
              <span className="font-semibold text-charcoal">Profit</span>
              <span className={`font-bold ${profitTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatMoney(profitTotal)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Trend chart */}
      <section
        aria-label="Revenue and Expense Trend"
        className="bg-charcoal-card rounded-2xl p-4 sm:p-5 border border-charcoal-border/60 shadow-soft-sm space-y-3.5"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-charcoal-border/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sage-100 text-sage-800 flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4 text-sage-700" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-charcoal tracking-tight">
                Revenue vs Expenses
              </h2>
              <p className="text-[11px] sm:text-xs text-charcoal-muted">
                Last {rows.length} {period === 'week' ? 'weeks' : 'months'} with activity.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-charcoal-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-sage-500"></span>
              <span>Revenue</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
              <span>Expenses</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600"></span>
              <span>Profit</span>
            </span>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="py-16 text-center text-charcoal-muted text-xs sm:text-sm">
            No completed jobs or expenses recorded yet.
          </div>
        ) : (
          <div className="pt-4 pb-2">
            <div className="flex items-end gap-2 sm:gap-3 h-52 sm:h-64 w-full px-1 border-b border-charcoal-border/70 overflow-x-auto">
              {rows.map((r) => {
                const revenue = r.revenueMobile + r.revenueShop;
                const expense = r.expenseMobile + r.expenseShop + r.expenseShared;
                const profit = revenue - expense;
                const pct = (v: number) =>
                  chartMax > 0 ? Math.max(Math.round((v / chartMax) * 100), v > 0 ? 6 : 2) : 2;

                return (
                  <div
                    key={r.key}
                    className="flex-1 flex flex-col items-center h-full justify-end group min-w-[52px] sm:min-w-[64px]"
                  >
                    <span
                      className={`text-[10px] sm:text-xs font-bold mb-1 opacity-80 group-hover:opacity-100 transition-all ${
                        profit >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}
                      title={`Profit: ${formatMoney(profit)}`}
                    >
                      {profit !== 0 ? formatMoney(profit).replace('CA', '') : ''}
                    </span>

                    <div className="w-full flex items-end justify-center gap-1 h-full">
                      <div
                        style={{ height: `${pct(revenue)}%` }}
                        className="w-1/2 max-w-[26px] rounded-t-lg bg-sage-500 hover:bg-sage-600 transition-colors shadow-soft-xs"
                        title={`${r.label} revenue: ${formatMoney(revenue)}`}
                      />
                      <div
                        style={{ height: `${pct(expense)}%` }}
                        className="w-1/2 max-w-[26px] rounded-t-lg bg-amber-500 hover:bg-amber-600 transition-colors shadow-soft-xs"
                        title={`${r.label} expenses: ${formatMoney(expense)}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-start gap-2 sm:gap-3 px-1 pt-2 overflow-x-auto">
              {rows.map((r) => (
                <div
                  key={r.key}
                  className="flex-1 text-center text-[10px] sm:text-[11px] text-charcoal-muted min-w-[52px] sm:min-w-[64px]"
                >
                  {r.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Expenses by category */}
      <section
        aria-label="Expenses by Category"
        className="bg-charcoal-card rounded-2xl p-4 sm:p-5 border border-charcoal-border/60 shadow-soft-sm space-y-3.5"
      >
        <div className="flex items-center gap-2 pb-3 border-b border-charcoal-border/40">
          <div className="w-8 h-8 rounded-xl bg-sage-100 text-sage-800 flex items-center justify-center shrink-0">
            <PieChart className="w-4 h-4 text-sage-700" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-charcoal tracking-tight">
              Expenses by Category
            </h2>
            <p className="text-[11px] sm:text-xs text-charcoal-muted">
              {formatMoney(totals.expenseFixed)} {EXPENSE_TYPE_LABELS.fixed.toLowerCase()} ·{' '}
              {formatMoney(totals.expenseVariable)} {EXPENSE_TYPE_LABELS.variable.toLowerCase()}
            </p>
          </div>
        </div>

        {categoryBreakdown.items.length === 0 ? (
          <div className="py-10 text-center text-charcoal-muted text-xs sm:text-sm">
            No expenses logged in this window yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {categoryBreakdown.items.map((item) => {
              const width =
                categoryBreakdown.max > 0
                  ? Math.max(Math.round((item.amount / categoryBreakdown.max) * 100), 4)
                  : 4;
              const share = expenseTotal > 0 ? Math.round((item.amount / expenseTotal) * 100) : 0;
              return (
                <div key={item.category} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-charcoal truncate">{item.category}</span>
                    <span className="text-charcoal-muted shrink-0">
                      {formatMoney(item.amount)} · {share}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-canvas border border-charcoal-border/60 overflow-hidden">
                    <div
                      style={{ width: `${width}%` }}
                      className="h-full rounded-full bg-sage-500 transition-all duration-300"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Detailer pay. Kept out of the profit figures above on purpose: a payout
          is a record of what someone is owed, and the cost of paying them is an
          expense entry. Rolling one into the other would double count the moment
          a wages expense is also recorded. */}
      <PayoutManager
        payouts={payouts}
        detailers={detailers}
        bookings={bookings}
        onAdd={handleAddPayout}
        onToggleStatus={handleTogglePayoutStatus}
        onDelete={handleDeletePayout}
      />

      {/* Manual expense entry */}
      <ExpenseManager
        expenses={expenses}
        categories={categories}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}
