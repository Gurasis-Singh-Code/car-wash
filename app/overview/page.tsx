'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Booking,
  BookingStatus,
  SERVICE_LABELS,
  CAR_TYPE_LABELS,
} from '@/types/booking';
import { getBookings, subscribeToBookings } from '@/lib/bookings';
import { resolveInstagram } from '@/lib/instagram';
import { useAuth } from '@/components/AuthProvider';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Zap,
  Droplet,
  Car,
  UserCheck,
  Phone,
  Search,
  ChevronRight,
  PieChart,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Instagram,
} from 'lucide-react';

type TimeframePreset =
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_30_days'
  | 'last_90_days'
  | 'this_year'
  | 'all_time'
  | 'custom';

interface DateRange {
  start: string; // 'YYYY-MM-DD'
  end: string;   // 'YYYY-MM-DD'
}

interface ChartItem {
  key: string;
  label: string;
  subLabel?: string;
  scheduled: number;
  completed: number;
  cancelled: number;
  total: number;
}

function formatDateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (y && m && d) {
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  } catch {
    // fallback
  }
  return dateStr;
}

function formatShortDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (y && m && d) {
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  } catch {
    // fallback
  }
  return dateStr;
}

/** Shared status pill, used by both the mobile card list and the desktop table. */
function StatusBadge({ status }: { status: BookingStatus }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
        <CheckCircle2 className="w-3 h-3" />
        <span>Completed</span>
      </span>
    );
  }
  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200/60">
        <AlertCircle className="w-3 h-3" />
        <span>Cancelled</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-sage-100 text-sage-800 border border-sage-200/80">
      <Clock3 className="w-3 h-3" />
      <span>Scheduled</span>
    </span>
  );
}

/** Instagram handle link, or the raw account ID when no handle is known. */
function InstagramTag({ booking }: { booking: Booking }) {
  const ig = resolveInstagram(booking.instagram_user_id, booking.instagram_username);
  if (!ig) return null;

  if (!ig.handle) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-charcoal-muted font-mono truncate max-w-[150px]">
        <Instagram className="w-2.5 h-2.5 shrink-0" />
        <span>{ig.accountId}</span>
      </span>
    );
  }

  return (
    <a
      href={ig.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[11px] text-pink-700 hover:text-pink-900 font-medium truncate max-w-[150px]"
      title={`Instagram: @${ig.handle}`}
    >
      <Instagram className="w-2.5 h-2.5 shrink-0 text-pink-600" />
      <span>@{ig.handle}</span>
    </a>
  );
}

function getPresetRange(preset: TimeframePreset): { current: DateRange; prior: DateRange; label: string } {
  const now = new Date();
  const todayIso = formatDateToIso(now);

  if (preset === 'this_week') {
    // Monday of current week
    const currentDay = now.getDay();
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + diffToMonday);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const startIso = formatDateToIso(startOfWeek);
    const endIso = formatDateToIso(endOfWeek);

    // Prior week
    const priorStart = new Date(startOfWeek);
    priorStart.setDate(startOfWeek.getDate() - 7);
    const priorEnd = new Date(endOfWeek);
    priorEnd.setDate(endOfWeek.getDate() - 7);

    return {
      current: { start: startIso, end: endIso },
      prior: { start: formatDateToIso(priorStart), end: formatDateToIso(priorEnd) },
      label: 'This Week',
    };
  }

  if (preset === 'last_week') {
    const currentDay = now.getDay();
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + diffToMonday - 7);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const priorStart = new Date(startOfWeek);
    priorStart.setDate(startOfWeek.getDate() - 7);
    const priorEnd = new Date(endOfWeek);
    priorEnd.setDate(endOfWeek.getDate() - 7);

    return {
      current: { start: formatDateToIso(startOfWeek), end: formatDateToIso(endOfWeek) },
      prior: { start: formatDateToIso(priorStart), end: formatDateToIso(priorEnd) },
      label: 'Last Week',
    };
  }

  if (preset === 'this_month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const priorStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const priorEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    return {
      current: { start: formatDateToIso(startOfMonth), end: formatDateToIso(endOfMonth) },
      prior: { start: formatDateToIso(priorStart), end: formatDateToIso(priorEnd) },
      label: `${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
    };
  }

  if (preset === 'last_month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const priorStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const priorEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0);

    return {
      current: { start: formatDateToIso(startOfMonth), end: formatDateToIso(endOfMonth) },
      prior: { start: formatDateToIso(priorStart), end: formatDateToIso(priorEnd) },
      label: `${startOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
    };
  }

  if (preset === 'last_30_days') {
    const start = new Date(now);
    start.setDate(now.getDate() - 29);
    const priorEnd = new Date(start);
    priorEnd.setDate(start.getDate() - 1);
    const priorStart = new Date(priorEnd);
    priorStart.setDate(priorEnd.getDate() - 29);

    return {
      current: { start: formatDateToIso(start), end: todayIso },
      prior: { start: formatDateToIso(priorStart), end: formatDateToIso(priorEnd) },
      label: 'Past 30 Days',
    };
  }

  if (preset === 'last_90_days') {
    const start = new Date(now);
    start.setDate(now.getDate() - 89);
    const priorEnd = new Date(start);
    priorEnd.setDate(start.getDate() - 1);
    const priorStart = new Date(priorEnd);
    priorStart.setDate(priorEnd.getDate() - 89);

    return {
      current: { start: formatDateToIso(start), end: todayIso },
      prior: { start: formatDateToIso(priorStart), end: formatDateToIso(priorEnd) },
      label: 'Past 90 Days',
    };
  }

  if (preset === 'this_year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    const priorStart = new Date(now.getFullYear() - 1, 0, 1);
    const priorEnd = new Date(now.getFullYear() - 1, 11, 31);

    return {
      current: { start: formatDateToIso(start), end: formatDateToIso(end) },
      prior: { start: formatDateToIso(priorStart), end: formatDateToIso(priorEnd) },
      label: `${now.getFullYear()} Year to Date`,
    };
  }

  // all_time fallback
  return {
    current: { start: '1970-01-01', end: '2099-12-31' },
    prior: { start: '1970-01-01', end: '1970-01-01' },
    label: 'All Time History',
  };
}

export default function OverviewPage() {
  const { isConfigured } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Timeframe filter state
  const [timeframePreset, setTimeframePreset] = useState<TimeframePreset>('this_month');
  const [customRange, setCustomRange] = useState<DateRange>({
    start: formatDateToIso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    end: formatDateToIso(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)),
  });

  // Table status and search filter
  const [tableStatusFilter, setTableStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await getBookings();
      setBookings(data);
    } catch (err: any) {
      console.error('[OverviewPage loadData error]:', err);
      setError(err?.message || 'Failed to load booking history.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Subscribe to Supabase Realtime changes
    const unsubscribe = subscribeToBookings(() => {
      console.log('[Overview Realtime] Booking change detected. Refreshing stats...');
      loadData();
    });

    return () => {
      unsubscribe();
    };
  }, [loadData]);

  // Active date range calculation
  const activeRangeInfo = useMemo(() => {
    if (timeframePreset === 'custom') {
      return {
        current: customRange,
        prior: { start: '1970-01-01', end: '1970-01-01' },
        label: `${formatShortDate(customRange.start)} – ${formatShortDate(customRange.end)}`,
      };
    }
    return getPresetRange(timeframePreset);
  }, [timeframePreset, customRange]);

  // Filter bookings within current selected range
  const currentPeriodBookings = useMemo(() => {
    const { start, end } = activeRangeInfo.current;
    return bookings.filter((b) => b.booking_date >= start && b.booking_date <= end);
  }, [bookings, activeRangeInfo]);

  // Filter bookings in the prior comparison range
  const priorPeriodBookings = useMemo(() => {
    const { start, end } = activeRangeInfo.prior;
    if (start === '1970-01-01' && end === '1970-01-01') return [];
    return bookings.filter((b) => b.booking_date >= start && b.booking_date <= end);
  }, [bookings, activeRangeInfo]);

  // Core metrics computation
  const metrics = useMemo(() => {
    const total = currentPeriodBookings.length;
    const scheduled = currentPeriodBookings.filter((b) => b.status === 'scheduled').length;
    const completed = currentPeriodBookings.filter((b) => b.status === 'completed').length;
    const cancelled = currentPeriodBookings.filter((b) => b.status === 'cancelled').length;

    const totalCars = currentPeriodBookings.reduce((sum, b) => sum + (b.car_count || 1), 0);
    const withPower = currentPeriodBookings.filter((b) => b.has_power).length;
    const withWater = currentPeriodBookings.filter((b) => b.has_water).length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const cancellationRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;
    const scheduledRate = total > 0 ? Math.round((scheduled / total) * 100) : 0;

    // Prior metrics for trend comparisons
    const priorTotal = priorPeriodBookings.length;
    const priorCompleted = priorPeriodBookings.filter((b) => b.status === 'completed').length;
    const priorScheduled = priorPeriodBookings.filter((b) => b.status === 'scheduled').length;
    const priorCancelled = priorPeriodBookings.filter((b) => b.status === 'cancelled').length;

    const calcDelta = (cur: number, pri: number) => {
      if (pri === 0) return cur > 0 ? 100 : 0;
      return Math.round(((cur - pri) / pri) * 100);
    };

    return {
      total,
      scheduled,
      completed,
      cancelled,
      totalCars,
      withPower,
      withWater,
      powerRate: total > 0 ? Math.round((withPower / total) * 100) : 0,
      waterRate: total > 0 ? Math.round((withWater / total) * 100) : 0,
      completionRate,
      cancellationRate,
      scheduledRate,
      deltas: {
        total: calcDelta(total, priorTotal),
        completed: calcDelta(completed, priorCompleted),
        scheduled: calcDelta(scheduled, priorScheduled),
        cancelled: calcDelta(cancelled, priorCancelled),
      },
      hasPriorComparison: priorPeriodBookings.length > 0 || (activeRangeInfo.prior.start !== '1970-01-01'),
    };
  }, [currentPeriodBookings, priorPeriodBookings, activeRangeInfo]);

  // Distribution by Service Package
  const serviceDistribution = useMemo(() => {
    const counts: Record<string, { count: number; completed: number; scheduled: number; cancelled: number }> = {};
    currentPeriodBookings.forEach((b) => {
      const s = b.service || 'interior_silver';
      if (!counts[s]) {
        counts[s] = { count: 0, completed: 0, scheduled: 0, cancelled: 0 };
      }
      counts[s].count += 1;
      if (b.status === 'completed') counts[s].completed += 1;
      else if (b.status === 'scheduled') counts[s].scheduled += 1;
      else if (b.status === 'cancelled') counts[s].cancelled += 1;
    });

    return Object.entries(counts)
      .map(([serviceKey, data]) => ({
        key: serviceKey,
        label: SERVICE_LABELS[serviceKey] || serviceKey,
        count: data.count,
        completed: data.completed,
        scheduled: data.scheduled,
        cancelled: data.cancelled,
        percentage: metrics.total > 0 ? Math.round((data.count / metrics.total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [currentPeriodBookings, metrics.total]);

  // Distribution by Assigned Detailer
  const detailerDistribution = useMemo(() => {
    const counts: Record<string, { total: number; completed: number; scheduled: number; cancelled: number; cars: number }> = {};
    currentPeriodBookings.forEach((b) => {
      const d = b.assigned_detailer?.trim() || 'Unassigned';
      if (!counts[d]) {
        counts[d] = { total: 0, completed: 0, scheduled: 0, cancelled: 0, cars: 0 };
      }
      counts[d].total += 1;
      counts[d].cars += b.car_count || 1;
      if (b.status === 'completed') counts[d].completed += 1;
      else if (b.status === 'scheduled') counts[d].scheduled += 1;
      else if (b.status === 'cancelled') counts[d].cancelled += 1;
    });

    return Object.entries(counts)
      .map(([name, data]) => ({
        name,
        total: data.total,
        completed: data.completed,
        scheduled: data.scheduled,
        cancelled: data.cancelled,
        cars: data.cars,
        completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [currentPeriodBookings]);

  // Distribution by Car Type
  const carTypeDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    currentPeriodBookings.forEach((b) => {
      const ct = b.car_type || 'sedan';
      counts[ct] = (counts[ct] || 0) + (b.car_count || 1);
    });

    return Object.entries(counts)
      .map(([typeKey, count]) => ({
        key: typeKey,
        label: CAR_TYPE_LABELS[typeKey as keyof typeof CAR_TYPE_LABELS] || typeKey,
        count,
        percentage: metrics.totalCars > 0 ? Math.round((count / metrics.totalCars) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [currentPeriodBookings, metrics.totalCars]);

  // Daily / Time-Series Performance Chart Data
  const timeSeriesData = useMemo(() => {
    // If weekly or short range <= 31 days: Group by Day
    // If year or all time > 60 days: Group by Month
    const { start } = activeRangeInfo.current;
    const isMonthlyGrouping =
      timeframePreset === 'this_year' ||
      timeframePreset === 'all_time' ||
      (timeframePreset === 'last_90_days');

    if (isMonthlyGrouping) {
      // Group by YYYY-MM
      const monthMap: Record<string, ChartItem> = {};

      currentPeriodBookings.forEach((b) => {
        const monthKey = b.booking_date.substring(0, 7); // '2026-08'
        if (!monthMap[monthKey]) {
          try {
            const [y, m] = monthKey.split('-').map(Number);
            const dt = new Date(y, m - 1, 1);
            monthMap[monthKey] = {
              key: monthKey,
              label: dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
              subLabel: undefined,
              scheduled: 0,
              completed: 0,
              cancelled: 0,
              total: 0,
            };
          } catch {
            monthMap[monthKey] = { key: monthKey, label: monthKey, subLabel: undefined, scheduled: 0, completed: 0, cancelled: 0, total: 0 };
          }
        }
        monthMap[monthKey].total += 1;
        if (b.status === 'completed') monthMap[monthKey].completed += 1;
        else if (b.status === 'scheduled') monthMap[monthKey].scheduled += 1;
        else if (b.status === 'cancelled') monthMap[monthKey].cancelled += 1;
      });

      const sorted: ChartItem[] = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, val]) => val);

      const maxVal = Math.max(...sorted.map((s) => s.total), 1);
      return { isMonthly: true, items: sorted, maxVal };
    }

    // Daily breakdown for This Week, Last Week, This Month, Last 30 Days, Custom Range
    const dayMap: Record<string, ChartItem> = {};

    // Pre-populate days in range if timeframe is This Week or Last Week (so empty days are shown)
    if (timeframePreset === 'this_week' || timeframePreset === 'last_week') {
      try {
        const [sy, sm, sd] = start.split('-').map(Number);
        const curDate = new Date(sy, sm - 1, sd);
        for (let i = 0; i < 7; i++) {
          const iso = formatDateToIso(curDate);
          const dayName = curDate.toLocaleDateString('en-US', { weekday: 'short' });
          const dayNum = curDate.getDate();
          dayMap[iso] = {
            key: iso,
            label: `${dayName}`,
            subLabel: `${dayNum}`,
            scheduled: 0,
            completed: 0,
            cancelled: 0,
            total: 0,
          };
          curDate.setDate(curDate.getDate() + 1);
        }
      } catch (e) {
        // ignore
      }
    }

    currentPeriodBookings.forEach((b) => {
      const dKey = b.booking_date;
      if (!dayMap[dKey]) {
        try {
          const [y, m, d] = dKey.split('-').map(Number);
          const dt = new Date(y, m - 1, d);
          dayMap[dKey] = {
            key: dKey,
            label: dt.toLocaleDateString('en-US', { weekday: 'short' }),
            subLabel: `${dt.getMonth() + 1}/${dt.getDate()}`,
            scheduled: 0,
            completed: 0,
            cancelled: 0,
            total: 0,
          };
        } catch {
          dayMap[dKey] = { key: dKey, label: dKey, subLabel: undefined, scheduled: 0, completed: 0, cancelled: 0, total: 0 };
        }
      }
      dayMap[dKey].total += 1;
      if (b.status === 'completed') dayMap[dKey].completed += 1;
      else if (b.status === 'scheduled') dayMap[dKey].scheduled += 1;
      else if (b.status === 'cancelled') dayMap[dKey].cancelled += 1;
    });

    const sorted: ChartItem[] = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, val]) => val);

    const maxVal = Math.max(...sorted.map((s) => s.total), 1);
    return { isMonthly: false, items: sorted, maxVal };
  }, [currentPeriodBookings, activeRangeInfo, timeframePreset]);

  // Filtered period bookings for the bottom table explorer
  const filteredTableBookings = useMemo(() => {
    return currentPeriodBookings
      .filter((b) => {
        if (tableStatusFilter !== 'all' && b.status !== tableStatusFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = b.customer_name?.toLowerCase().includes(q);
          const matchAddress = b.address?.toLowerCase().includes(q);
          const matchPhone = (b.number || b.client_no)?.toLowerCase().includes(q);
          const matchInstagram =
            b.instagram_user_id?.toLowerCase().includes(q) ||
            b.instagram_username?.toLowerCase().includes(q);
          const matchDetailer = b.assigned_detailer?.toLowerCase().includes(q);
          const matchService = (SERVICE_LABELS[b.service] || b.service)?.toLowerCase().includes(q);
          return matchName || matchAddress || matchPhone || matchInstagram || matchDetailer || matchService;
        }
        return true;
      })
      .sort((a, b) => {
        const dtA = `${a.booking_date} ${a.booking_time}`;
        const dtB = `${b.booking_date} ${b.booking_time}`;
        return dtB.localeCompare(dtA); // newest first
      });
  }, [currentPeriodBookings, tableStatusFilter, searchQuery]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-12">
      {/* Page Header with Live Sync badge & refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-2 border-b border-charcoal-border/40">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-charcoal">
              Performance & Analytics Overview
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-sage-100 text-sage-800">
              <Sparkles className="w-3 h-3 text-sage-600" />
              Live Sync
            </span>
          </div>
          <p className="text-xs sm:text-sm text-charcoal-muted mt-0.5 sm:mt-1">
            Weekly and monthly operational insights, completion metrics, and service breakdowns.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={() => loadData()}
            className="p-2.5 rounded-xl border border-charcoal-border/60 bg-charcoal-card hover:bg-sage-50 text-charcoal-muted hover:text-charcoal shadow-soft-sm transition-colors shrink-0"
            title="Refresh Analytics"
            aria-label="Refresh Analytics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sage-600' : ''}`} />
          </button>
          <Link
            href="/admin"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-sage-500 hover:bg-sage-600 active:scale-[0.99] text-white dark:text-charcoal-card text-xs sm:text-sm font-semibold rounded-xl shadow-soft-sm transition-all"
          >
            <span>Manage Bookings</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Database connection notice if not configured */}
      {!isConfigured && (
        <div className="p-4 rounded-xl bg-sage-50/80 border border-sage-200 text-charcoal text-xs flex items-start gap-3">
          <div className="w-6 h-6 rounded-lg bg-sage-200/80 text-sage-800 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="font-semibold text-charcoal">Supabase Live Connection Ready</p>
            <p className="text-charcoal-muted mt-0.5">
              Set <code className="font-mono bg-charcoal-card px-1 py-0.5 rounded border border-sage-200">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono bg-charcoal-card px-1 py-0.5 rounded border border-sage-200">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code className="font-mono bg-charcoal-card px-1 py-0.5 rounded border border-sage-200">.env.local</code> to aggregate live analytics.
            </p>
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Timeframe Filter Bar */}
      <section aria-label="Timeframe Selector" className="bg-charcoal-card rounded-2xl p-4 sm:p-5 border border-charcoal-border/60 shadow-soft-sm space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-charcoal-border/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sage-100 text-sage-800 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-sage-700" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-charcoal tracking-tight">
                Select Timeframe Window
              </h2>
              <p className="text-[11px] sm:text-xs text-charcoal-muted">
                Viewing performance for <strong className="text-charcoal font-semibold">{activeRangeInfo.label}</strong> ({formatDisplayDate(activeRangeInfo.current.start)} to {formatDisplayDate(activeRangeInfo.current.end)})
              </p>
            </div>
          </div>

          {/* Timeframe Presets */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-canvas border border-charcoal-border/70 rounded-xl overflow-x-auto">
            <button
              type="button"
              onClick={() => setTimeframePreset('this_week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                timeframePreset === 'this_week'
                  ? 'bg-sage-600 text-white dark:text-charcoal-card shadow-soft-xs'
                  : 'text-charcoal-muted hover:text-charcoal hover:bg-charcoal-card'
              }`}
            >
              This Week
            </button>

            <button
              type="button"
              onClick={() => setTimeframePreset('last_week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                timeframePreset === 'last_week'
                  ? 'bg-sage-600 text-white dark:text-charcoal-card shadow-soft-xs'
                  : 'text-charcoal-muted hover:text-charcoal hover:bg-charcoal-card'
              }`}
            >
              Last Week
            </button>

            <button
              type="button"
              onClick={() => setTimeframePreset('this_month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                timeframePreset === 'this_month'
                  ? 'bg-sage-600 text-white dark:text-charcoal-card shadow-soft-xs'
                  : 'text-charcoal-muted hover:text-charcoal hover:bg-charcoal-card'
              }`}
            >
              This Month
            </button>

            <button
              type="button"
              onClick={() => setTimeframePreset('last_month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                timeframePreset === 'last_month'
                  ? 'bg-sage-600 text-white dark:text-charcoal-card shadow-soft-xs'
                  : 'text-charcoal-muted hover:text-charcoal hover:bg-charcoal-card'
              }`}
            >
              Last Month
            </button>

            <button
              type="button"
              onClick={() => setTimeframePreset('last_30_days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                timeframePreset === 'last_30_days'
                  ? 'bg-sage-600 text-white dark:text-charcoal-card shadow-soft-xs'
                  : 'text-charcoal-muted hover:text-charcoal hover:bg-charcoal-card'
              }`}
            >
              30 Days
            </button>

            <button
              type="button"
              onClick={() => setTimeframePreset('last_90_days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                timeframePreset === 'last_90_days'
                  ? 'bg-sage-600 text-white dark:text-charcoal-card shadow-soft-xs'
                  : 'text-charcoal-muted hover:text-charcoal hover:bg-charcoal-card'
              }`}
            >
              90 Days
            </button>

            <button
              type="button"
              onClick={() => setTimeframePreset('this_year')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                timeframePreset === 'this_year'
                  ? 'bg-sage-600 text-white dark:text-charcoal-card shadow-soft-xs'
                  : 'text-charcoal-muted hover:text-charcoal hover:bg-charcoal-card'
              }`}
            >
              This Year
            </button>

            <button
              type="button"
              onClick={() => setTimeframePreset('all_time')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                timeframePreset === 'all_time'
                  ? 'bg-sage-600 text-white dark:text-charcoal-card shadow-soft-xs'
                  : 'text-charcoal-muted hover:text-charcoal hover:bg-charcoal-card'
              }`}
            >
              All Time
            </button>

            <button
              type="button"
              onClick={() => setTimeframePreset('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                timeframePreset === 'custom'
                  ? 'bg-sage-600 text-white dark:text-charcoal-card shadow-soft-xs'
                  : 'text-charcoal-muted hover:text-charcoal hover:bg-charcoal-card'
              }`}
            >
              Custom Range
            </button>
          </div>
        </div>

        {/* Custom Range Inputs (shown when Custom Range is selected) */}
        {timeframePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-1 animate-fade-in">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-charcoal-muted">From:</label>
              <input
                type="date"
                value={customRange.start}
                onChange={(e) => setCustomRange((prev) => ({ ...prev, start: e.target.value }))}
                className="px-3 py-2 sm:py-1.5 rounded-xl text-base sm:text-xs bg-canvas border border-charcoal-border focus:bg-charcoal-card focus:border-sage-500 transition-all text-charcoal cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-charcoal-muted">To:</label>
              <input
                type="date"
                value={customRange.end}
                onChange={(e) => setCustomRange((prev) => ({ ...prev, end: e.target.value }))}
                className="px-3 py-2 sm:py-1.5 rounded-xl text-base sm:text-xs bg-canvas border border-charcoal-border focus:bg-charcoal-card focus:border-sage-500 transition-all text-charcoal cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={() => setTimeframePreset('this_month')}
              className="text-xs text-sage-700 hover:text-sage-800 underline font-medium"
            >
              Reset to This Month
            </button>
          </div>
        )}
      </section>

      {/* KPI Performance Cards (4 Grid) */}
      <section aria-label="Key Performance Indicators" className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-6">
        {/* Total Bookings Card */}
        <div className="bg-charcoal-card rounded-xl p-3.5 sm:p-5 border border-charcoal-border/60 shadow-soft-sm hover:shadow-soft-md transition-all duration-200">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
              Total Volume
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-sage-50 text-sage-700 flex items-center justify-center border border-sage-100 shrink-0">
              <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-charcoal">
              {metrics.total}
            </span>
            <span className="text-[11px] sm:text-xs text-charcoal-muted">
              {metrics.total === 1 ? 'appointment' : 'appointments'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs mt-2 pt-2 border-t border-charcoal-border/30">
            <span className="text-charcoal-muted">
              {metrics.totalCars} total {metrics.totalCars === 1 ? 'vehicle' : 'vehicles'}
            </span>
            {metrics.hasPriorComparison && (
              <span
                className={`inline-flex items-center gap-0.5 font-semibold ${
                  metrics.deltas.total >= 0 ? 'text-emerald-700' : 'text-charcoal-muted'
                }`}
                title="Change vs prior period"
              >
                {metrics.deltas.total >= 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {metrics.deltas.total > 0 ? `+${metrics.deltas.total}%` : `${metrics.deltas.total}%`}
              </span>
            )}
          </div>
        </div>

        {/* Completed Bookings Card */}
        <div className="bg-charcoal-card rounded-xl p-3.5 sm:p-5 border border-charcoal-border/60 shadow-soft-sm hover:shadow-soft-md transition-all duration-200">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Completed Details
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-700">
              {metrics.completed}
            </span>
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-700/80">
              ({metrics.completionRate}% rate)
            </span>
          </div>

          <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs mt-2 pt-2 border-t border-charcoal-border/30">
            <span className="text-charcoal-muted">Finished to date</span>
            {metrics.hasPriorComparison && (
              <span
                className={`inline-flex items-center gap-0.5 font-semibold ${
                  metrics.deltas.completed >= 0 ? 'text-emerald-700' : 'text-amber-700'
                }`}
                title="Change in completed appointments vs prior period"
              >
                {metrics.deltas.completed >= 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {metrics.deltas.completed > 0 ? `+${metrics.deltas.completed}%` : `${metrics.deltas.completed}%`}
              </span>
            )}
          </div>
        </div>

        {/* Scheduled / Pending Bookings Card */}
        <div className="bg-charcoal-card rounded-xl p-3.5 sm:p-5 border border-charcoal-border/60 shadow-soft-sm hover:shadow-soft-md transition-all duration-200">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-sage-800">
              Scheduled / Active
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-sage-50 text-sage-800 flex items-center justify-center border border-sage-200 shrink-0">
              <Clock3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-sage-900">
              {metrics.scheduled}
            </span>
            <span className="text-[11px] sm:text-xs font-semibold text-sage-700">
              ({metrics.scheduledRate}% of period)
            </span>
          </div>

          <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs mt-2 pt-2 border-t border-charcoal-border/30">
            <span className="text-charcoal-muted">Pending execution</span>
            {metrics.hasPriorComparison && (
              <span className="text-charcoal-muted text-[10px]">
                {metrics.scheduled > 0 ? 'Upcoming' : 'None pending'}
              </span>
            )}
          </div>
        </div>

        {/* Cancelled Bookings Card */}
        <div className="bg-charcoal-card rounded-xl p-3.5 sm:p-5 border border-charcoal-border/60 shadow-soft-sm hover:shadow-soft-md transition-all duration-200">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-red-700">
              Cancelled
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-200/60 shrink-0">
              <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-red-600">
              {metrics.cancelled}
            </span>
            <span className="text-[11px] sm:text-xs font-semibold text-red-600/80">
              ({metrics.cancellationRate}% rate)
            </span>
          </div>

          <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs mt-2 pt-2 border-t border-charcoal-border/30">
            <span className="text-charcoal-muted">Non-fulfilled details</span>
            {metrics.hasPriorComparison && (
              <span
                className={`inline-flex items-center gap-0.5 font-semibold ${
                  metrics.deltas.cancelled <= 0 ? 'text-emerald-700' : 'text-red-600'
                }`}
                title="Change in cancelled appointments vs prior period"
              >
                {metrics.deltas.cancelled > 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {metrics.deltas.cancelled > 0 ? `+${metrics.deltas.cancelled}%` : `${metrics.deltas.cancelled}%`}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Visual Rate Status Bar */}
      <section aria-label="Status Distribution Bar" className="bg-charcoal-card rounded-2xl p-4 sm:p-5 border border-charcoal-border/60 shadow-soft-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-sage-600" />
            <h3 className="text-sm sm:text-base font-bold text-charcoal">
              Fulfillment & Status Ratio
            </h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold flex-wrap">
            <div className="flex items-center gap-1.5 text-emerald-800">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Completed ({metrics.completed}) • {metrics.completionRate}%</span>
            </div>
            <div className="flex items-center gap-1.5 text-sage-800">
              <span className="w-2.5 h-2.5 rounded-full bg-sage-500"></span>
              <span>Scheduled ({metrics.scheduled}) • {metrics.scheduledRate}%</span>
            </div>
            <div className="flex items-center gap-1.5 text-red-700">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <span>Cancelled ({metrics.cancelled}) • {metrics.cancellationRate}%</span>
            </div>
          </div>
        </div>

        {/* Multi-color Proportional Progress Bar */}
        <div className="w-full h-3 bg-charcoal-surface rounded-full overflow-hidden flex shadow-inner">
          {metrics.completed > 0 && (
            <div
              style={{ width: `${(metrics.completed / metrics.total) * 100}%` }}
              className="bg-emerald-500 hover:bg-emerald-600 transition-all duration-500"
              title={`Completed: ${metrics.completed} (${metrics.completionRate}%)`}
            />
          )}
          {metrics.scheduled > 0 && (
            <div
              style={{ width: `${(metrics.scheduled / metrics.total) * 100}%` }}
              className="bg-sage-500 hover:bg-sage-600 transition-all duration-500"
              title={`Scheduled: ${metrics.scheduled} (${metrics.scheduledRate}%)`}
            />
          )}
          {metrics.cancelled > 0 && (
            <div
              style={{ width: `${(metrics.cancelled / metrics.total) * 100}%` }}
              className="bg-red-500 hover:bg-red-600 transition-all duration-500"
              title={`Cancelled: ${metrics.cancelled} (${metrics.cancellationRate}%)`}
            />
          )}
          {metrics.total === 0 && (
            <div className="w-full bg-charcoal-border/50 text-center text-[10px] text-charcoal-muted" />
          )}
        </div>
      </section>

      {/* Main Performance Grid: Time Series Chart & Breakdown Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left / Top (8 Cols): Performance Chart across Time Intervals */}
        <div className="lg:col-span-8 bg-charcoal-card rounded-2xl p-4 sm:p-6 border border-charcoal-border/60 shadow-soft-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-charcoal-border/40">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-charcoal tracking-tight flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sage-600" />
                <span>
                  {timeSeriesData.isMonthly ? 'Monthly Performance Distribution' : 'Daily Volume & Execution Breakdown'}
                </span>
              </h2>
              <p className="text-xs text-charcoal-muted mt-0.5">
                Stacked breakdown of Scheduled, Completed, and Cancelled appointments over time.
              </p>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px] sm:text-xs font-medium text-charcoal-muted">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                <span>Completed</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-sage-500"></span>
                <span>Scheduled</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-400"></span>
                <span>Cancelled</span>
              </span>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          {timeSeriesData.items.length === 0 ? (
            <div className="py-16 text-center text-charcoal-muted text-xs sm:text-sm">
              No appointments recorded in this timeframe window.
            </div>
          ) : (
            <div className="pt-4 pb-2">
              <div className="flex items-end gap-2 sm:gap-3 h-52 sm:h-64 w-full px-1 border-b border-charcoal-border/70 overflow-x-auto">
                {timeSeriesData.items.map((item) => {
                  const total = item.total;
                  const completedRatio = total > 0 ? item.completed / total : 0;
                  const scheduledRatio = total > 0 ? item.scheduled / total : 0;
                  const cancelledRatio = total > 0 ? item.cancelled / total : 0;

                  // Height scale relative to maxVal
                  const heightPercent = total > 0 ? Math.max(Math.round((total / timeSeriesData.maxVal) * 100), 12) : 4;

                  return (
                    <div
                      key={item.key}
                      className="flex-1 flex flex-col items-center h-full justify-end group min-w-[36px] sm:min-w-[48px]"
                    >
                      {/* Hover Tooltip Value */}
                      <span className="text-[10px] sm:text-xs font-bold text-charcoal mb-1 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all">
                        {total > 0 ? total : ''}
                      </span>

                      {/* Stacked Bar Container */}
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full max-w-[44px] rounded-t-lg overflow-hidden flex flex-col-reverse transition-all duration-300 group-hover:opacity-95 shadow-soft-xs ${
                          total === 0 ? 'bg-charcoal-surface/70' : ''
                        }`}
                      >
                        {/* Completed portion (bottom) */}
                        {item.completed > 0 && (
                          <div
                            style={{ height: `${completedRatio * 100}%` }}
                            className="bg-emerald-500 hover:bg-emerald-600 transition-colors w-full"
                            title={`${item.label}: ${item.completed} Completed`}
                          />
                        )}

                        {/* Scheduled portion (middle) */}
                        {item.scheduled > 0 && (
                          <div
                            style={{ height: `${scheduledRatio * 100}%` }}
                            className="bg-sage-500 hover:bg-sage-600 transition-colors w-full"
                            title={`${item.label}: ${item.scheduled} Scheduled`}
                          />
                        )}

                        {/* Cancelled portion (top) */}
                        {item.cancelled > 0 && (
                          <div
                            style={{ height: `${cancelledRatio * 100}%` }}
                            className="bg-red-400 hover:bg-red-500 transition-colors w-full"
                            title={`${item.label}: ${item.cancelled} Cancelled`}
                          />
                        )}
                      </div>

                      {/* X-axis Label */}
                      <div className="mt-2 text-center">
                        <span className="block text-[11px] sm:text-xs font-semibold text-charcoal group-hover:text-sage-700 transition-colors truncate">
                          {item.label}
                        </span>
                        {item.subLabel && (
                          <span className="block text-[9px] sm:text-[10px] text-charcoal-muted -mt-0.5">
                            {item.subLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick summary footer */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-charcoal-muted">
            <span>
              Peak interval:{' '}
              <strong className="text-charcoal font-semibold">
                {timeSeriesData.items.reduce((prev, curr) => (curr.total > prev.total ? curr : prev), { label: 'None', total: 0, key: '', scheduled: 0, completed: 0, cancelled: 0 }).label}
              </strong>{' '}
              ({timeSeriesData.maxVal} {timeSeriesData.maxVal === 1 ? 'booking' : 'bookings'})
            </span>
            <span>
              Average per interval:{' '}
              <strong className="text-charcoal font-semibold">
                {timeSeriesData.items.length > 0
                  ? (metrics.total / timeSeriesData.items.length).toFixed(1)
                  : '0'}
              </strong>
            </span>
          </div>
        </div>

        {/* Right (4 Cols): Utilities & Detailer Performance Insights */}
        <div className="lg:col-span-4 space-y-6">
          {/* Detailer Performance Workload Card */}
          <div className="bg-charcoal-card rounded-2xl p-4 sm:p-5 border border-charcoal-border/60 shadow-soft-sm space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-charcoal-border/40">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm sm:text-base font-bold text-charcoal">
                  Detailer Performance
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-charcoal-muted">
                {detailerDistribution.length} Team Members
              </span>
            </div>

            {detailerDistribution.length === 0 ? (
              <p className="text-xs text-charcoal-muted py-3 text-center">No assignments yet.</p>
            ) : (
              <div className="space-y-3">
                {detailerDistribution.map((d) => (
                  <div
                    key={d.name}
                    className="p-2.5 rounded-xl bg-canvas border border-charcoal-border/50 hover:border-sage-300 transition-all text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-charcoal flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${d.name === 'Unassigned' ? 'bg-amber-400' : 'bg-purple-500'}`} />
                        {d.name}
                      </span>
                      <span className="text-charcoal-muted">
                        {d.total} {d.total === 1 ? 'service' : 'services'} ({d.cars} {d.cars === 1 ? 'car' : 'cars'})
                      </span>
                    </div>

                    {/* Completion rate bar */}
                    <div className="flex items-center justify-between text-[11px] text-charcoal-muted">
                      <span>Completed: <strong className="text-emerald-700">{d.completed}</strong></span>
                      <span>Scheduled: <strong className="text-sage-800">{d.scheduled}</strong></span>
                      <span>Cancelled: <strong className="text-red-600">{d.cancelled}</strong></span>
                    </div>

                    <div className="w-full h-1.5 bg-charcoal-border/40 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${d.total > 0 ? (d.completed / d.total) * 100 : 0}%` }}
                        className="bg-emerald-500 h-full"
                      />
                      <div
                        style={{ width: `${d.total > 0 ? (d.scheduled / d.total) * 100 : 0}%` }}
                        className="bg-sage-500 h-full"
                      />
                      <div
                        style={{ width: `${d.total > 0 ? (d.cancelled / d.total) * 100 : 0}%` }}
                        className="bg-red-400 h-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Utilities & On-Site Readiness Card */}
          <div className="bg-charcoal-card rounded-2xl p-4 sm:p-5 border border-charcoal-border/60 shadow-soft-sm space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-charcoal-border/40">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sage-600" />
                <h3 className="text-sm sm:text-base font-bold text-charcoal">
                  On-Site Utility Readiness
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-800 font-semibold">
                  <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Power Ready</span>
                </div>
                <div className="text-xl font-bold text-amber-900">
                  {metrics.powerRate}%
                </div>
                <p className="text-[10px] text-amber-700">
                  {metrics.withPower} of {metrics.total} locations
                </p>
              </div>

              <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200/70 space-y-1">
                <div className="flex items-center gap-1.5 text-sky-800 font-semibold">
                  <Droplet className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>Water Ready</span>
                </div>
                <div className="text-xl font-bold text-sky-900">
                  {metrics.waterRate}%
                </div>
                <p className="text-[10px] text-sky-700">
                  {metrics.withWater} of {metrics.total} locations
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Breakdowns: Service Packages & Vehicle Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {/* Service Package Popularity Card */}
        <div className="bg-charcoal-card rounded-2xl p-4 sm:p-6 border border-charcoal-border/60 shadow-soft-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-charcoal-border/40">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sage-600" />
              <h3 className="text-base font-bold text-charcoal">
                Service Package Popularity
              </h3>
            </div>
            <span className="text-xs font-semibold text-charcoal-muted">
              {serviceDistribution.length} Packages
            </span>
          </div>

          {serviceDistribution.length === 0 ? (
            <p className="text-xs text-charcoal-muted py-6 text-center">No service data in this timeframe.</p>
          ) : (
            <div className="space-y-3.5">
              {serviceDistribution.map((item) => (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-charcoal">
                      {item.label}
                    </span>
                    <span className="text-charcoal-muted font-medium">
                      {item.count} bookings ({item.percentage}%)
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-charcoal-surface rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${item.percentage}%` }}
                      className="bg-sage-500 hover:bg-sage-600 rounded-full transition-all duration-300"
                    />
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-charcoal-muted">
                    <span>Completed: <strong className="text-emerald-700">{item.completed}</strong></span>
                    <span>Scheduled: <strong className="text-sage-800">{item.scheduled}</strong></span>
                    <span>Cancelled: <strong className="text-red-600">{item.cancelled}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vehicle Category Distribution */}
        <div className="bg-charcoal-card rounded-2xl p-4 sm:p-6 border border-charcoal-border/60 shadow-soft-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-charcoal-border/40">
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-sage-600" />
              <h3 className="text-base font-bold text-charcoal">
                Vehicle Category Distribution
              </h3>
            </div>
            <span className="text-xs font-semibold text-charcoal-muted">
              {metrics.totalCars} Total Vehicles
            </span>
          </div>

          {carTypeDistribution.length === 0 ? (
            <p className="text-xs text-charcoal-muted py-6 text-center">No vehicle data in this timeframe.</p>
          ) : (
            <div className="space-y-3.5">
              {carTypeDistribution.map((item) => (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-charcoal flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5 text-sage-600" />
                      {item.label}
                    </span>
                    <span className="text-charcoal-muted font-medium">
                      {item.count} cars ({item.percentage}%)
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-charcoal-surface rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${item.percentage}%` }}
                      className="bg-sage-600 hover:bg-sage-700 rounded-full transition-all duration-300"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Period Bookings Activity Explorer / Table */}
      <section aria-label="Period Appointments Registry" className="bg-charcoal-card rounded-2xl p-4 sm:p-6 border border-charcoal-border/60 shadow-soft-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-charcoal-border/40">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-charcoal tracking-tight">
              Period Appointments Explorer
            </h2>
            <p className="text-xs text-charcoal-muted mt-0.5">
              Detailed record of all appointments within the selected {activeRangeInfo.label} timeframe.
            </p>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-charcoal-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search name, phone, detailer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-2.5 sm:py-1.5 rounded-xl text-base sm:text-xs bg-canvas border border-charcoal-border focus:bg-charcoal-card focus:border-sage-500 text-charcoal w-full sm:w-56"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-charcoal-muted hover:text-charcoal"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-canvas border border-charcoal-border/70 rounded-xl">
              <button
                type="button"
                onClick={() => setTableStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  tableStatusFilter === 'all'
                    ? 'bg-charcoal-card text-charcoal shadow-soft-xs'
                    : 'text-charcoal-muted hover:text-charcoal'
                }`}
              >
                All ({currentPeriodBookings.length})
              </button>

              <button
                type="button"
                onClick={() => setTableStatusFilter('completed')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  tableStatusFilter === 'completed'
                    ? 'bg-emerald-100 text-emerald-900 shadow-soft-xs'
                    : 'text-charcoal-muted hover:text-emerald-800'
                }`}
              >
                Completed ({metrics.completed})
              </button>

              <button
                type="button"
                onClick={() => setTableStatusFilter('scheduled')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  tableStatusFilter === 'scheduled'
                    ? 'bg-sage-100 text-sage-900 shadow-soft-xs'
                    : 'text-charcoal-muted hover:text-sage-800'
                }`}
              >
                Scheduled ({metrics.scheduled})
              </button>

              <button
                type="button"
                onClick={() => setTableStatusFilter('cancelled')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  tableStatusFilter === 'cancelled'
                    ? 'bg-red-100 text-red-900 shadow-soft-xs'
                    : 'text-charcoal-muted hover:text-red-800'
                }`}
              >
                Cancelled ({metrics.cancelled})
              </button>
            </div>
          </div>
        </div>

        {/* Table View */}
        {filteredTableBookings.length === 0 ? (
          <div className="py-12 text-center text-charcoal-muted text-xs sm:text-sm">
            No matching appointments found for this filter criteria.
          </div>
        ) : (
          <>
          {/* Mobile card list - a 7 column table is unreadable on a phone */}
          <div className="md:hidden space-y-2.5">
            {filteredTableBookings.map((booking) => (
              <div
                key={booking.id}
                className="rounded-xl border border-charcoal-border/60 bg-canvas p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-charcoal text-sm truncate" title={booking.customer_name}>
                      {booking.customer_name}
                    </p>
                    <p className="text-[11px] text-charcoal-muted">
                      {formatDisplayDate(booking.booking_date)} &bull; {booking.booking_time}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={booking.status} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sage-50 text-sage-800 border border-sage-200">
                    {SERVICE_LABELS[booking.service] || booking.service}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-charcoal-card text-charcoal-muted border border-charcoal-border/50">
                    <Car className="w-3 h-3 shrink-0" />
                    <span>
                      {booking.car_count && booking.car_count > 1 ? `${booking.car_count}x ` : ''}
                      {CAR_TYPE_LABELS[booking.car_type] || booking.car_type}
                    </span>
                  </span>
                  {booking.assigned_detailer && booking.assigned_detailer !== 'Unassigned' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200/60">
                      <UserCheck className="w-3 h-3 shrink-0" />
                      <span>{booking.assigned_detailer}</span>
                    </span>
                  )}
                  {booking.has_power && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/70">
                      <Zap className="w-3 h-3 shrink-0" />
                      Power
                    </span>
                  )}
                  {booking.has_water && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-800 border border-sky-200/70">
                      <Droplet className="w-3 h-3 shrink-0" />
                      Water
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5 border-t border-charcoal-border/40">
                  {(booking.number || booking.client_no) && (
                    <a
                      href={`tel:${(booking.number || booking.client_no || '').replace(/[^0-9+]/g, '')}`}
                      className="inline-flex items-center gap-1 text-[11px] text-sage-700 font-medium py-1"
                    >
                      <Phone className="w-3 h-3 shrink-0" />
                      <span>{booking.number || booking.client_no}</span>
                    </a>
                  )}
                  <InstagramTag booking={booking} />
                </div>

                {booking.address && (
                  <p className="text-[11px] text-charcoal-muted break-words" title={booking.address}>
                    {booking.address}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-charcoal-border/60 text-charcoal-muted font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Client / Contact</th>
                  <th className="py-2.5 px-3">Service Package</th>
                  <th className="py-2.5 px-3">Vehicle</th>
                  <th className="py-2.5 px-3">Detailer</th>
                  <th className="py-2.5 px-3">Utilities</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-border/30">
                {filteredTableBookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className="hover:bg-sage-50/40 transition-colors"
                  >
                    {/* Date & Time */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-semibold text-charcoal">
                        {formatDisplayDate(booking.booking_date)}
                      </div>
                      <div className="text-[11px] text-charcoal-muted">
                        {booking.booking_time}
                      </div>
                    </td>

                    {/* Customer & Phone & Instagram */}
                    <td className="py-3 px-3">
                      <div className="font-bold text-charcoal truncate max-w-[140px]" title={booking.customer_name}>
                        {booking.customer_name}
                      </div>
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        {(booking.number || booking.client_no) && (
                          <a
                            href={`tel:${(booking.number || booking.client_no || '').replace(/[^0-9+]/g, '')}`}
                            className="inline-flex items-center gap-1 text-[11px] text-sage-700 hover:text-sage-900 font-medium"
                          >
                            <Phone className="w-2.5 h-2.5 shrink-0" />
                            <span>{booking.number || booking.client_no}</span>
                          </a>
                        )}
                        <InstagramTag booking={booking} />
                      </div>
                      <div className="text-[10px] text-charcoal-muted truncate max-w-[160px] mt-0.5" title={booking.address}>
                        {booking.address}
                      </div>
                    </td>

                    {/* Service Package */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sage-50 text-sage-800 border border-sage-200">
                        {SERVICE_LABELS[booking.service] || booking.service}
                      </span>
                    </td>

                    {/* Vehicle */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-charcoal">
                        <Car className="w-3 h-3 text-charcoal-muted" />
                        <span>
                          {booking.car_count && booking.car_count > 1 ? `${booking.car_count}x ` : ''}
                          {CAR_TYPE_LABELS[booking.car_type] || booking.car_type}
                        </span>
                      </span>
                    </td>

                    {/* Detailer */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {booking.assigned_detailer && booking.assigned_detailer !== 'Unassigned' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200/60">
                          <UserCheck className="w-2.5 h-2.5" />
                          <span>{booking.assigned_detailer}</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-charcoal-muted">Unassigned</span>
                      )}
                    </td>

                    {/* Utilities */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span
                          className={`p-1 rounded ${booking.has_power ? 'bg-amber-50 text-amber-700' : 'text-charcoal-light opacity-40'}`}
                          title={booking.has_power ? 'Power Available' : 'No Power'}
                        >
                          <Zap className="w-3 h-3" />
                        </span>
                        <span
                          className={`p-1 rounded ${booking.has_water ? 'bg-sky-50 text-sky-700' : 'text-charcoal-light opacity-40'}`}
                          title={booking.has_water ? 'Water Available' : 'No Water'}
                        >
                          <Droplet className="w-3 h-3" />
                        </span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3 whitespace-nowrap text-right">
                      <StatusBadge status={booking.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </div>
  );
}
