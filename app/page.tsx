'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Booking, BookingStats } from '@/types/booking';
import { getStats, getUpcomingBookings, subscribeToBookings } from '@/lib/bookings';
import { useAuth } from '@/components/AuthProvider';
import StatCardsGrid from '@/components/StatCard';
import BookingList from '@/components/BookingList';
import {
  Plus,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Calendar as CalendarIcon,
  CalendarDays,
  Clock,
  Filter,
  X,
  RotateCcw,
} from 'lucide-react';

type DateFilterPreset = 'all' | 'today' | 'tomorrow' | 'this_week' | 'custom_date' | 'day_of_week';

const DAYS_OF_WEEK = [
  { label: 'Sun', full: 'Sunday', value: 0 },
  { label: 'Mon', full: 'Monday', value: 1 },
  { label: 'Tue', full: 'Tuesday', value: 2 },
  { label: 'Wed', full: 'Wednesday', value: 3 },
  { label: 'Thu', full: 'Thursday', value: 4 },
  { label: 'Fri', full: 'Friday', value: 5 },
  { label: 'Sat', full: 'Saturday', value: 6 },
];

function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function HomePage() {
  const { isConfigured } = useAuth();
  const [stats, setStats] = useState<BookingStats | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date and Day filter states
  const [filterPreset, setFilterPreset] = useState<DateFilterPreset>('all');
  const [selectedCustomDate, setSelectedCustomDate] = useState<string>('');
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [statsData, bookingsData] = await Promise.all([
        getStats(),
        getUpcomingBookings(),
      ]);
      setStats(statsData);
      setBookings(bookingsData);
    } catch (err: any) {
      console.error('[HomePage loadData error]:', err);
      setError(err?.message || 'Failed to load live bookings.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Subscribe to Supabase Realtime changes
    const unsubscribe = subscribeToBookings(() => {
      console.log('[HomePage Realtime] Booking change detected. Refreshing data...');
      loadData();
    });

    return () => {
      unsubscribe();
    };
  }, [loadData]);

  // Today and Tomorrow strings
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return getLocalDateString(d);
  }, []);

  // 7-day window for "This Week"
  const next7DaysStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return getLocalDateString(d);
  }, []);

  // Filtered bookings based on selected date or day filter
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (filterPreset === 'all') return true;

      if (filterPreset === 'today') {
        return b.booking_date === todayStr;
      }

      if (filterPreset === 'tomorrow') {
        return b.booking_date === tomorrowStr;
      }

      if (filterPreset === 'this_week') {
        return b.booking_date >= todayStr && b.booking_date <= next7DaysStr;
      }

      if (filterPreset === 'custom_date') {
        if (!selectedCustomDate) return true;
        return b.booking_date === selectedCustomDate;
      }

      if (filterPreset === 'day_of_week' && selectedDayOfWeek !== null) {
        try {
          const [y, m, d] = b.booking_date.split('-').map(Number);
          const dateObj = new Date(y, m - 1, d);
          return dateObj.getDay() === selectedDayOfWeek;
        } catch {
          return false;
        }
      }

      return true;
    });
  }, [bookings, filterPreset, todayStr, tomorrowStr, next7DaysStr, selectedCustomDate, selectedDayOfWeek]);

  // Reset all date/day filters
  const resetFilters = () => {
    setFilterPreset('all');
    setSelectedCustomDate('');
    setSelectedDayOfWeek(null);
  };

  const handleCustomDateChange = (dateVal: string) => {
    setSelectedCustomDate(dateVal);
    if (dateVal) {
      setFilterPreset('custom_date');
      setSelectedDayOfWeek(null);
    } else {
      setFilterPreset('all');
    }
  };

  const handleDayOfWeekSelect = (dayVal: number) => {
    if (filterPreset === 'day_of_week' && selectedDayOfWeek === dayVal) {
      // Toggle off
      setFilterPreset('all');
      setSelectedDayOfWeek(null);
    } else {
      setFilterPreset('day_of_week');
      setSelectedDayOfWeek(dayVal);
      setSelectedCustomDate('');
    }
  };

  // Active filter label
  const activeFilterLabel = useMemo(() => {
    if (filterPreset === 'today') return `Today (${todayStr})`;
    if (filterPreset === 'tomorrow') return `Tomorrow (${tomorrowStr})`;
    if (filterPreset === 'this_week') return 'Next 7 Days';
    if (filterPreset === 'custom_date' && selectedCustomDate) {
      try {
        const [y, m, d] = selectedCustomDate.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      } catch {
        return selectedCustomDate;
      }
    }
    if (filterPreset === 'day_of_week' && selectedDayOfWeek !== null) {
      return `Every ${DAYS_OF_WEEK.find((d) => d.value === selectedDayOfWeek)?.full}`;
    }
    return null;
  }, [filterPreset, todayStr, tomorrowStr, selectedCustomDate, selectedDayOfWeek]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-2 border-b border-charcoal-border/40">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-charcoal">
              Operations Dashboard
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-sage-100 text-sage-800">
              <Sparkles className="w-3 h-3 text-sage-600" />
              Live Sync
            </span>
          </div>
          <p className="text-xs sm:text-sm text-charcoal-muted mt-0.5 sm:mt-1">
            Real-time schedule overview and upcoming mobile detailing appointments.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={() => loadData()}
            className="p-2.5 rounded-xl border border-charcoal-border/60 bg-charcoal-card hover:bg-sage-50 text-charcoal-muted hover:text-charcoal shadow-soft-sm transition-colors shrink-0"
            title="Refresh Live Data"
            aria-label="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sage-600' : ''}`} />
          </button>
          <Link
            href="/admin"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-sage-500 hover:bg-sage-600 active:scale-[0.99] text-white dark:text-charcoal-card text-xs sm:text-sm font-semibold rounded-xl shadow-soft-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Appointment</span>
          </Link>
        </div>
      </div>

      {/* Notice if Supabase not configured */}
      {!isConfigured && (
        <div className="p-4 rounded-xl bg-sage-50/80 border border-sage-200 text-charcoal text-xs flex items-start gap-3">
          <div className="w-6 h-6 rounded-lg bg-sage-200/80 text-sage-800 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="font-semibold text-charcoal">Supabase Live Connection Ready</p>
            <p className="text-charcoal-muted mt-0.5">
              Set <code className="font-mono bg-charcoal-card px-1 py-0.5 rounded border border-sage-200">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono bg-charcoal-card px-1 py-0.5 rounded border border-sage-200">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code className="font-mono bg-charcoal-card px-1 py-0.5 rounded border border-sage-200">.env.local</code> to connect your live Supabase instance.
            </p>
          </div>
        </div>
      )}

      {/* Error alert if fetch failed */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Section: 4 StatCards (renders skeleton when stats is null) */}
      <section aria-label="Booking Statistics">
        <StatCardsGrid stats={stats} />
      </section>

      {/* Date & Day Filter Section */}
      <section aria-label="Schedule Filter Controls" className="bg-charcoal-card rounded-2xl p-4 sm:p-5 border border-charcoal-border/60 shadow-soft-sm space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-charcoal-border/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sage-100 text-sage-800 flex items-center justify-center shrink-0">
              <Filter className="w-4 h-4 text-sage-700" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-charcoal tracking-tight">
                Filter by Date or Day
              </h2>
              <p className="text-[11px] sm:text-xs text-charcoal-muted">
                Quickly narrow down the schedule by day, preset window, or custom date.
              </p>
            </div>
          </div>

          {/* Preset Buttons: All / Today / Tomorrow / This Week */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-canvas border border-charcoal-border/70 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setFilterPreset('all');
                setSelectedCustomDate('');
                setSelectedDayOfWeek(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterPreset === 'all'
                  ? 'bg-sage-600 text-white dark:text-charcoal-card shadow-soft-xs'
                  : 'text-charcoal-muted hover:text-charcoal hover:bg-charcoal-card'
              }`}
            >
              All
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterPreset('today');
                setSelectedCustomDate('');
                setSelectedDayOfWeek(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                filterPreset === 'today'
                  ? 'bg-sage-600 text-white dark:text-charcoal-card shadow-soft-xs'
                  : 'text-charcoal-muted hover:text-charcoal hover:bg-charcoal-card'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>Today</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterPreset('tomorrow');
                setSelectedCustomDate('');
                setSelectedDayOfWeek(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                filterPreset === 'tomorrow'
                  ? 'bg-sage-600 text-white dark:text-charcoal-card shadow-soft-xs'
                  : 'text-charcoal-muted hover:text-charcoal hover:bg-charcoal-card'
              }`}
            >
              <CalendarIcon className="w-3 h-3" />
              <span>Tomorrow</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterPreset('this_week');
                setSelectedCustomDate('');
                setSelectedDayOfWeek(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                filterPreset === 'this_week'
                  ? 'bg-sage-600 text-white dark:text-charcoal-card shadow-soft-xs'
                  : 'text-charcoal-muted hover:text-charcoal hover:bg-charcoal-card'
              }`}
            >
              <CalendarDays className="w-3 h-3" />
              <span>This Week</span>
            </button>
          </div>
        </div>

        {/* Secondary Filter Controls: Custom Date Picker + Days of Week Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Custom Date Input */}
          <div className="sm:col-span-5 flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-charcoal-muted">
                <CalendarIcon className="w-4 h-4 text-sage-600" />
              </div>
              <input
                type="date"
                value={selectedCustomDate}
                onChange={(e) => handleCustomDateChange(e.target.value)}
                className={`w-full pl-9 pr-3 py-2.5 sm:py-2 rounded-xl text-base sm:text-xs bg-canvas border ${
                  filterPreset === 'custom_date' && selectedCustomDate
                    ? 'border-sage-500 ring-2 ring-sage-400/20 bg-charcoal-card font-medium text-charcoal'
                    : 'border-charcoal-border text-charcoal hover:border-sage-300'
                } focus:bg-charcoal-card transition-all cursor-pointer`}
                title="Select specific date"
              />
            </div>
            {selectedCustomDate && (
              <button
                type="button"
                onClick={() => handleCustomDateChange('')}
                className="p-2 rounded-lg text-charcoal-muted hover:text-charcoal hover:bg-sage-50 border border-charcoal-border/60 transition-colors shrink-0"
                title="Clear date"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Day of the Week Pills */}
          <div className="sm:col-span-7 flex flex-wrap items-center gap-1 sm:justify-end">
            <span className="text-[11px] font-semibold text-charcoal-muted uppercase tracking-wider mr-1 hidden lg:inline">
              Day:
            </span>
            {DAYS_OF_WEEK.map((day) => {
              const isSelected = filterPreset === 'day_of_week' && selectedDayOfWeek === day.value;
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => handleDayOfWeekSelect(day.value)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-sage-600 text-white dark:text-charcoal-card shadow-soft-xs font-bold'
                      : 'bg-canvas text-charcoal-muted hover:text-charcoal hover:bg-charcoal-card border border-charcoal-border/70'
                  }`}
                  title={`Filter by ${day.full}`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Filter Indicator Bar */}
        {activeFilterLabel && (
          <div className="pt-2 border-t border-charcoal-border/30 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-charcoal-muted">Active filter:</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold bg-sage-100 text-sage-900 border border-sage-300">
                <span>{activeFilterLabel}</span>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="hover:text-red-700 transition-colors p-0.5"
                  title="Remove filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
              <span className="text-charcoal-muted">
                ({filteredBookings.length} {filteredBookings.length === 1 ? 'match' : 'matches'})
              </span>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-xs font-medium text-sage-700 hover:text-sage-900 underline hover:no-underline"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}
      </section>

      {/* Bookings List Section: Displays empty state when filteredBookings.length === 0 */}
      <section aria-label="Upcoming Schedule">
        <BookingList
          bookings={filteredBookings}
          title={activeFilterLabel ? `Filtered Schedule (${activeFilterLabel})` : 'Upcoming Appointments'}
          subtitle={
            activeFilterLabel
              ? `Showing ${filteredBookings.length} scheduled detailing ${
                  filteredBookings.length === 1 ? 'service' : 'services'
                }`
              : 'Live queue of scheduled mobile detailing services'
          }
          emptyMessage={
            activeFilterLabel
              ? `No appointments found for ${activeFilterLabel}`
              : 'No bookings scheduled yet'
          }
          showActions={false}
        />
      </section>
    </div>
  );
}

