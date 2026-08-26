'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Booking, BookingStats } from '@/types/booking';
import { getStats, getUpcomingBookings, subscribeToBookings } from '@/lib/bookings';
import { useAuth } from '@/components/AuthProvider';
import StatCardsGrid from '@/components/StatCard';
import BookingList from '@/components/BookingList';
import { Plus, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';

export default function HomePage() {
  const { isConfigured } = useAuth();
  const [stats, setStats] = useState<BookingStats | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            className="p-2.5 rounded-xl border border-charcoal-border/60 bg-white hover:bg-sage-50 text-charcoal-muted hover:text-charcoal shadow-soft-sm transition-colors shrink-0"
            title="Refresh Live Data"
            aria-label="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sage-600' : ''}`} />
          </button>
          <Link
            href="/admin"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-sage-500 hover:bg-sage-600 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-soft-sm transition-all"
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
              Set <code className="font-mono bg-white px-1 py-0.5 rounded border border-sage-200">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono bg-white px-1 py-0.5 rounded border border-sage-200">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code className="font-mono bg-white px-1 py-0.5 rounded border border-sage-200">.env.local</code> to connect your live Supabase instance.
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

      {/* Bookings List Section: Displays empty state when bookings.length === 0 */}
      <section aria-label="Upcoming Schedule">
        <BookingList
          bookings={bookings}
          title="Upcoming Appointments"
          subtitle="Live queue of scheduled mobile detailing services"
          emptyMessage="No bookings scheduled yet"
          showActions={false}
        />
      </section>
    </div>
  );
}
