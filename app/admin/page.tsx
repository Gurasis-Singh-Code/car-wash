'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Booking, BookingStatus } from '@/types/booking';
import { Detailer } from '@/types/detailer';
import {
  getBookings,
  addBooking,
  updateBooking,
  deleteBooking,
  subscribeToBookings,
  assignDetailer,
} from '@/lib/bookings';
import {
  getDetailers,
  addDetailer,
  updateDetailerStatus,
  deleteDetailer,
  subscribeToDetailers,
  linkDetailerLogin,
  unlinkDetailerLogin,
} from '@/lib/detailers';
import { useAuth } from '@/components/AuthProvider';
import BookingForm, { BookingFormData } from '@/components/BookingForm';
import BookingList from '@/components/BookingList';
import EditBookingModal from '@/components/EditBookingModal';
import DetailerManager from '@/components/DetailerManager';
import { ShieldCheck, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';

export default function AdminPage() {
  const { isConfigured } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [detailers, setDetailers] = useState<Detailer[]>([]);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    try {
      setError(null);
      const data = await getBookings();
      setBookings(data);
    } catch (err: any) {
      console.error('[AdminPage loadBookings error]:', err);
      setError(err?.message || 'Failed to load bookings from Supabase.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadDetailers = useCallback(async () => {
    try {
      setDetailers(await getDetailers());
    } catch (err: any) {
      console.error('[AdminPage loadDetailers error]:', err);
      setError(err?.message || 'Failed to load detailers from Supabase.');
    }
  }, []);

  useEffect(() => {
    loadDetailers();
    const unsubscribeDetailers = subscribeToDetailers(() => loadDetailers());
    return () => unsubscribeDetailers();
  }, [loadDetailers]);

  useEffect(() => {
    loadBookings();

    // Subscribe to realtime updates on bookings table
    const unsubscribe = subscribeToBookings(() => {
      console.log('[AdminPage Realtime] Booking change detected. Refreshing list...');
      loadBookings();
    });

    return () => {
      unsubscribe();
    };
  }, [loadBookings]);

  // Only active detailers are offered for new assignments; an already-assigned
  // inactive detailer stays visible on their own bookings.
  const activeDetailers = useMemo(
    () => detailers.filter((d) => d.status === 'active'),
    [detailers]
  );

  const assignedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.forEach((b) => {
      if (b.assigned_detailer_id) {
        counts[b.assigned_detailer_id] = (counts[b.assigned_detailer_id] || 0) + 1;
      }
    });
    return counts;
  }, [bookings]);

  const handleAssignDetailer = async (bookingId: string, detailer: Detailer | null) => {
    const previousBookings = [...bookings];
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              assigned_detailer_id: detailer ? detailer.id : null,
              assigned_detailer: detailer ? detailer.name : 'Unassigned',
            }
          : b
      )
    );

    try {
      setError(null);
      await assignDetailer(bookingId, detailer);
    } catch (err: any) {
      console.error('[handleAssignDetailer error]:', err);
      setBookings(previousBookings);
      setError(err?.message || 'Failed to assign detailer on Supabase.');
    }
  };

  const handleAddDetailer = async (name: string) => {
    const created = await addDetailer(name);
    setDetailers((prev) => [...prev, created]);
  };

  const handleToggleDetailerStatus = async (detailer: Detailer) => {
    const next = detailer.status === 'active' ? 'inactive' : 'active';
    try {
      setError(null);
      const updated = await updateDetailerStatus(detailer.id, next);
      setDetailers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch (err: any) {
      setError(err?.message || 'Failed to update detailer status.');
    }
  };

  // Link / unlink throw on failure so DetailerManager can show the reason inline
  // next to the row being edited, rather than in the page-level error banner.
  const handleLinkDetailerLogin = async (detailer: Detailer, email: string) => {
    const updated = await linkDetailerLogin(detailer.id, email);
    setDetailers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  const handleUnlinkDetailerLogin = async (detailer: Detailer) => {
    const updated = await unlinkDetailerLogin(detailer.id);
    setDetailers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  const handleDeleteDetailer = async (detailer: Detailer) => {
    const previousDetailers = [...detailers];
    setDetailers((prev) => prev.filter((d) => d.id !== detailer.id));
    try {
      setError(null);
      await deleteDetailer(detailer.id);
      // Their bookings return to the unassigned queue (FK is ON DELETE SET NULL).
      await loadBookings();
    } catch (err: any) {
      console.error('[handleDeleteDetailer error]:', err);
      setDetailers(previousDetailers);
      setError(err?.message || 'Failed to delete detailer.');
    }
  };

  // Create booking handler wired to Supabase addBooking
  const handleCreateBooking = async (formData: BookingFormData) => {
    try {
      setError(null);
      const created = await addBooking(formData);
      // Optimistically update list
      setBookings((prev) => [created, ...prev]);
    } catch (err: any) {
      console.error('[handleCreateBooking error]:', err);
      const msg = err?.message || 'Failed to create booking on Supabase.';
      setError(msg);
      throw new Error(msg); // re-throw so BookingForm displays inline error
    }
  };

  // Status toggle handler wired to Supabase updateBooking with optimistic updates
  const handleStatusChange = async (id: string, newStatus: BookingStatus) => {
    const previousBookings = [...bookings];
    // Optimistic update
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
    );

    try {
      setError(null);
      await updateBooking(id, { status: newStatus });
    } catch (err: any) {
      console.error('[handleStatusChange error]:', err);
      // Rollback on error
      setBookings(previousBookings);
      setError(err?.message || 'Failed to update booking status on Supabase.');
    }
  };

  // Edit booking handlers wired to Supabase updateBooking
  const handleEditClick = (booking: Booking) => {
    setEditingBooking(booking);
  };

  const handleSaveEditedBooking = async (updatedData: BookingFormData) => {
    if (!editingBooking) return;

    const previousBookings = [...bookings];
    // Optimistic update
    setBookings((prev) =>
      prev.map((b) =>
        b.id === editingBooking.id ? { ...b, ...updatedData } : b
      )
    );

    try {
      setError(null);
      await updateBooking(editingBooking.id, updatedData);
    } catch (err: any) {
      console.error('[handleSaveEditedBooking error]:', err);
      // Rollback on error
      setBookings(previousBookings);
      setError(err?.message || 'Failed to update booking on Supabase.');
    } finally {
      setEditingBooking(null);
    }
  };

  // Delete booking handler wired to Supabase deleteBooking with optimistic rollback
  const handleDeleteBooking = async (id: string) => {
    const previousBookings = [...bookings];
    // Optimistic deletion
    setBookings((prev) => prev.filter((b) => b.id !== id));

    try {
      setError(null);
      await deleteBooking(id);
    } catch (err: any) {
      console.error('[handleDeleteBooking error]:', err);
      // Rollback on error
      setBookings(previousBookings);
      setError(err?.message || 'Failed to delete booking on Supabase.');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-2 border-b border-charcoal-border/40">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-charcoal">
              Admin & Scheduling Management
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-sage-100 text-sage-800">
              <ShieldCheck className="w-3.5 h-3.5 text-sage-700" />
              Admin Portal
            </span>
          </div>
          <p className="text-xs sm:text-sm text-charcoal-muted mt-0.5 sm:mt-1">
            Create bookings for either service location and manage the full appointment registry.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => loadBookings()}
            className="p-2.5 rounded-xl border border-charcoal-border/60 bg-charcoal-card hover:bg-sage-50 text-charcoal-muted hover:text-charcoal shadow-soft-sm transition-colors"
            title="Refresh Bookings"
            aria-label="Refresh Bookings"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sage-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Setup notification banner if credentials not configured */}
      {!isConfigured && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-sage-50/80 border border-sage-200 text-charcoal text-xs flex items-start gap-3">
          <div className="w-6 h-6 rounded-lg bg-sage-200/80 text-sage-800 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="font-semibold text-charcoal">Supabase Live Backend Ready</p>
            <p className="text-charcoal-muted mt-0.5">
              Execute <code className="font-mono bg-charcoal-card px-1 py-0.5 rounded border border-sage-200">supabase/schema.sql</code> in your Supabase SQL Editor and enter credentials in <code className="font-mono bg-charcoal-card px-1 py-0.5 rounded border border-sage-200">.env.local</code> for full CRUD and Realtime sync.
            </p>
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Form on Left/Top, Booking List on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left Column: Booking Form */}
        <div className="lg:col-span-5 flex justify-center lg:justify-start w-full">
          <div className="w-full space-y-6 sm:space-y-8">
            <BookingForm onSubmit={handleCreateBooking} detailers={activeDetailers} />
            <DetailerManager
              detailers={detailers}
              assignedCounts={assignedCounts}
              onAdd={handleAddDetailer}
              onToggleStatus={handleToggleDetailerStatus}
              onDelete={handleDeleteDetailer}
              onLinkLogin={handleLinkDetailerLogin}
              onUnlinkLogin={handleUnlinkDetailerLogin}
            />
          </div>
        </div>

        {/* Right Column: Manage Bookings List */}
        <div className="lg:col-span-7 w-full">
          <BookingList
            bookings={bookings}
            title="All Bookings"
            subtitle="Full appointment directory with quick status toggles and controls"
            emptyMessage="No bookings scheduled yet"
            showActions={true}
            showLocationFilter={true}
            showAssignmentFilter={true}
            detailers={activeDetailers}
            onAssignDetailer={handleAssignDetailer}
            showStatusFilter={true}
            onStatusChange={handleStatusChange}
            onEdit={handleEditClick}
            onDelete={handleDeleteBooking}
          />
        </div>
      </div>

      {/* Edit Booking Modal */}
      <EditBookingModal
        booking={editingBooking}
        isOpen={Boolean(editingBooking)}
        onClose={() => setEditingBooking(null)}
        onSave={handleSaveEditedBooking}
        detailers={activeDetailers}
      />
    </div>
  );
}
