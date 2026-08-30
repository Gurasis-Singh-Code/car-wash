'use client';

import React, { useState, useMemo } from 'react';
import {
  Booking,
  SERVICE_LABELS,
  CAR_TYPE_LABELS,
  STATUS_LABELS,
  BookingStatus,
} from '@/types/booking';
import ConfirmModal from './ConfirmModal';
import {
  Calendar,
  Clock,
  MapPin,
  Car,
  Zap,
  Droplet,
  Edit2,
  Trash2,
  CalendarX,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Phone,
  UserCheck,
  Filter,
  Check,
  X,
  Loader2,
  Instagram,
} from 'lucide-react';

interface BookingListProps {
  bookings: Booking[];
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
  showActions?: boolean;
  showStatusFilter?: boolean;
  onEdit?: (booking: Booking) => void;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, newStatus: BookingStatus) => void | Promise<void>;
}

export default function BookingList({
  bookings = [],
  title = 'Scheduled Bookings',
  subtitle,
  emptyMessage = 'No bookings scheduled yet',
  showActions = false,
  showStatusFilter = false,
  onEdit,
  onDelete,
  onStatusChange,
}: BookingListProps) {
  const [deletingBooking, setDeletingBooking] = useState<Booking | null>(null);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Status counts for filter tabs
  const statusCounts = useMemo(() => {
    const counts = {
      all: bookings.length,
      scheduled: 0,
      completed: 0,
      cancelled: 0,
    };
    bookings.forEach((b) => {
      if (b.status === 'scheduled') counts.scheduled += 1;
      else if (b.status === 'completed') counts.completed += 1;
      else if (b.status === 'cancelled') counts.cancelled += 1;
    });
    return counts;
  }, [bookings]);

  // Filter bookings based on selected status filter
  const filteredBookings = useMemo(() => {
    if (selectedStatusFilter === 'all') {
      return bookings;
    }
    return bookings.filter((b) => b.status === selectedStatusFilter);
  }, [bookings, selectedStatusFilter]);

  // Sort filtered bookings by date and time ascending
  const sortedBookings = useMemo(() => {
    return [...filteredBookings].sort((a, b) => {
      const dateTimeA = `${a.booking_date} ${a.booking_time}`;
      const dateTimeB = `${b.booking_date} ${b.booking_time}`;
      return dateTimeA.localeCompare(dateTimeB);
    });
  }, [filteredBookings]);

  const handleConfirmDelete = () => {
    if (deletingBooking && onDelete) {
      onDelete(deletingBooking.id);
      setDeletingBooking(null);
    }
  };

  const handleStatusToggle = async (booking: Booking, newStatus: BookingStatus) => {
    if (booking.status === newStatus || !onStatusChange) return;
    try {
      setUpdatingStatusId(booking.id);
      await onStatusChange(booking.id, newStatus);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <CheckCircle2 className="w-3 h-3" />
            {STATUS_LABELS.completed}
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200/60">
            <AlertCircle className="w-3 h-3" />
            {STATUS_LABELS.cancelled}
          </span>
        );
      case 'scheduled':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sage-100 text-sage-800 border border-sage-200/80">
            <Clock3 className="w-3 h-3" />
            {STATUS_LABELS.scheduled}
          </span>
        );
    }
  };

  const formatDisplayTime = (timeStr: string) => {
    try {
      const parts = timeStr.split(':');
      if (parts.length >= 2) {
        const hours = parseInt(parts[0], 10);
        const minutes = parts[1];
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12;
        return `${formattedHours}:${minutes} ${ampm}`;
      }
    } catch {
      // Fallback
    }
    return timeStr;
  };

  const formatDisplayDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      if (year && month && day) {
        const dateObj = new Date(year, month - 1, day);
        return dateObj.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
    } catch {
      // Fallback
    }
    return dateStr;
  };

  return (
    <div className="w-full space-y-4">
      {/* Header section */}
      {(title || subtitle) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            {title && (
              <h2 className="text-lg sm:text-xl font-semibold text-charcoal tracking-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs sm:text-sm text-charcoal-muted mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {bookings.length > 0 && (
            <div className="text-xs text-charcoal-muted font-medium bg-sage-50 px-3 py-1 rounded-full w-fit border border-sage-100 shrink-0">
              {filteredBookings.length} of {bookings.length} {bookings.length === 1 ? 'appointment' : 'appointments'}
            </div>
          )}
        </div>
      )}

      {/* Status Filter Tabs (Scheduled / Completed / Cancelled / All) */}
      {showStatusFilter && (
        <div className="flex items-center gap-1.5 p-1 bg-[#FAF9F6] border border-charcoal-border/70 rounded-2xl overflow-x-auto no-scrollbar shadow-soft-xs">
          <button
            type="button"
            onClick={() => setSelectedStatusFilter('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedStatusFilter === 'all'
                ? 'bg-white text-charcoal shadow-soft-xs border border-charcoal-border/80'
                : 'text-charcoal-muted hover:text-charcoal hover:bg-white/60'
            }`}
          >
            <span>All</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              selectedStatusFilter === 'all' ? 'bg-sage-100 text-sage-800' : 'bg-charcoal-border/40 text-charcoal-muted'
            }`}>
              {statusCounts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatusFilter('scheduled')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedStatusFilter === 'scheduled'
                ? 'bg-sage-100 text-sage-900 shadow-soft-xs border border-sage-300'
                : 'text-charcoal-muted hover:text-sage-800 hover:bg-sage-50/70'
            }`}
          >
            <Clock3 className="w-3 h-3 text-sage-700" />
            <span>Scheduled</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              selectedStatusFilter === 'scheduled' ? 'bg-sage-200 text-sage-900' : 'bg-charcoal-border/40 text-charcoal-muted'
            }`}>
              {statusCounts.scheduled}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatusFilter('completed')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedStatusFilter === 'completed'
                ? 'bg-emerald-100 text-emerald-900 shadow-soft-xs border border-emerald-300'
                : 'text-charcoal-muted hover:text-emerald-800 hover:bg-emerald-50/70'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            <span>Completed</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              selectedStatusFilter === 'completed' ? 'bg-emerald-200 text-emerald-900' : 'bg-charcoal-border/40 text-charcoal-muted'
            }`}>
              {statusCounts.completed}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatusFilter('cancelled')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedStatusFilter === 'cancelled'
                ? 'bg-red-100 text-red-900 shadow-soft-xs border border-red-300'
                : 'text-charcoal-muted hover:text-red-800 hover:bg-red-50/70'
            }`}
          >
            <AlertCircle className="w-3 h-3 text-red-700" />
            <span>Cancelled</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              selectedStatusFilter === 'cancelled' ? 'bg-red-200 text-red-900' : 'bg-charcoal-border/40 text-charcoal-muted'
            }`}>
              {statusCounts.cancelled}
            </span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {sortedBookings.length === 0 ? (
        <div className="bg-white rounded-xl p-8 sm:p-12 text-center border border-charcoal-border/60 shadow-soft-sm">
          <div className="w-12 h-12 rounded-2xl bg-sage-50 text-sage-600 flex items-center justify-center mx-auto mb-4 border border-sage-100">
            <CalendarX className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-charcoal mb-1">
            {selectedStatusFilter !== 'all'
              ? `No ${selectedStatusFilter} bookings found`
              : emptyMessage}
          </h3>
          <p className="text-xs sm:text-sm text-charcoal-muted max-w-sm mx-auto">
            {selectedStatusFilter !== 'all' ? (
              <span>
                There are currently no bookings with status &quot;{selectedStatusFilter}&quot;.
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter('all')}
                  className="ml-1 text-sage-700 underline font-semibold hover:text-sage-800"
                >
                  View all bookings
                </button>
              </span>
            ) : (
              'Appointments will appear here in chronological order once they are scheduled.'
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {sortedBookings.map((booking) => {
            const isUpdating = updatingStatusId === booking.id;

            return (
              <div
                key={booking.id}
                className="bg-white rounded-xl p-3.5 sm:p-5 border border-charcoal-border/60 shadow-soft-sm hover:shadow-soft-md hover:border-sage-300/80 transition-all duration-200"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                  {/* Left & Middle details */}
                  <div className="flex-1 space-y-2.5 sm:space-y-3">
                    {/* Row 1: Customer Name + Phone + Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-charcoal tracking-tight mr-1">
                        {booking.customer_name}
                      </h3>

                      {/* Client Phone Link - High-visibility touch target */}
                      {(booking.number || booking.client_no) && (
                        <a
                          href={`tel:${(booking.number || booking.client_no || '').replace(/[^0-9+]/g, '')}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sage-100/90 text-sage-800 hover:bg-sage-200/90 border border-sage-300/80 transition-colors active:scale-95 shadow-soft-xs"
                          title={`Call client: ${booking.number || booking.client_no}`}
                        >
                          <Phone className="w-3.5 h-3.5 text-sage-700 shrink-0" />
                          <span>{booking.number || booking.client_no}</span>
                        </a>
                      )}

                      {/* Instagram User ID / Profile Link */}
                      {booking.instagram_user_id && (
                        <a
                          href={
                            booking.instagram_user_id.startsWith('http')
                              ? booking.instagram_user_id
                              : `https://instagram.com/${booking.instagram_user_id.replace(/^@/, '')}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200/80 transition-colors active:scale-95 shadow-soft-xs"
                          title={`Instagram profile: ${booking.instagram_user_id}`}
                        >
                          <Instagram className="w-3.5 h-3.5 text-pink-600 shrink-0" />
                          <span>
                            {booking.instagram_user_id.startsWith('@')
                              ? booking.instagram_user_id
                              : `@${booking.instagram_user_id}`}
                          </span>
                        </a>
                      )}

                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sage-50 text-sage-800 border border-sage-200">
                        {SERVICE_LABELS[booking.service] || booking.service}
                      </span>

                      {/* Vehicle Type & Count */}
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-charcoal-surface text-charcoal-muted border border-charcoal-border/50">
                        <Car className="w-3 h-3 text-charcoal-muted shrink-0" />
                        <span>
                          {booking.car_count && booking.car_count > 1 ? `${booking.car_count}x ` : ''}
                          {CAR_TYPE_LABELS[booking.car_type] || booking.car_type}
                        </span>
                      </span>

                      {/* Assigned Detailer */}
                      {booking.assigned_detailer && booking.assigned_detailer !== 'Unassigned' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200/60">
                          <UserCheck className="w-3 h-3 text-purple-600 shrink-0" />
                          <span>{booking.assigned_detailer}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                          <UserCheck className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Unassigned</span>
                        </span>
                      )}

                      {/* If onStatusChange is not provided, show standard badge */}
                      {!onStatusChange && getStatusBadge(booking.status)}
                    </div>

                    {/* Row 2: Date, Time, Address */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 text-xs text-charcoal-muted">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-sage-600 shrink-0" />
                          <span className="font-medium text-charcoal">
                            {formatDisplayDate(booking.booking_date)}
                          </span>
                        </div>
                        <span className="text-charcoal-border">|</span>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-sage-600 shrink-0" />
                          <span>{formatDisplayTime(booking.booking_time)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-sage-600 shrink-0" />
                        <span className="truncate text-charcoal/90" title={booking.address}>
                          {booking.address}
                        </span>
                      </div>
                    </div>

                    {/* Row 3: Utilities on site */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                          booking.has_power
                            ? 'bg-amber-50 text-amber-800 border border-amber-200/70'
                            : 'bg-charcoal-surface/60 text-charcoal-light border border-charcoal-border/40'
                        }`}
                      >
                        <Zap className="w-3 h-3 text-amber-600 shrink-0" />
                        {booking.has_power ? 'Power On-Site' : 'No Power'}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                          booking.has_water
                            ? 'bg-sky-50 text-sky-800 border border-sky-200/70'
                            : 'bg-charcoal-surface/60 text-charcoal-light border border-charcoal-border/40'
                        }`}
                      >
                        <Droplet className="w-3 h-3 text-sky-600 shrink-0" />
                        {booking.has_water ? 'Water On-Site' : 'No Water'}
                      </span>
                    </div>

                    {/* Row 4 (Admin Mode): Interactive Status Switcher Toggle (Scheduled / Completed / Cancelled) */}
                    {onStatusChange && (
                      <div className="pt-2 border-t border-charcoal-border/30 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-muted flex items-center gap-1">
                          Status:
                        </span>
                        <div className="inline-flex items-center p-0.5 rounded-lg bg-[#FAF9F6] border border-charcoal-border/70 shadow-soft-xs">
                          {/* Schedule Toggle Button */}
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleStatusToggle(booking, 'scheduled')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                              booking.status === 'scheduled'
                                ? 'bg-sage-600 text-white font-semibold shadow-soft-xs'
                                : 'text-charcoal-muted hover:text-sage-800 hover:bg-sage-50/80'
                            }`}
                            title="Set status to Scheduled"
                          >
                            <Clock3 className="w-3 h-3" />
                            <span>Scheduled</span>
                          </button>

                          {/* Complete Toggle Button */}
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleStatusToggle(booking, 'completed')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                              booking.status === 'completed'
                                ? 'bg-emerald-600 text-white font-semibold shadow-soft-xs'
                                : 'text-charcoal-muted hover:text-emerald-800 hover:bg-emerald-50/80'
                            }`}
                            title="Set status to Completed"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Completed</span>
                          </button>

                          {/* Cancel Toggle Button */}
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleStatusToggle(booking, 'cancelled')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                              booking.status === 'cancelled'
                                ? 'bg-red-600 text-white font-semibold shadow-soft-xs'
                                : 'text-charcoal-muted hover:text-red-800 hover:bg-red-50/80'
                            }`}
                            title="Set status to Cancelled"
                          >
                            <AlertCircle className="w-3 h-3" />
                            <span>Cancelled</span>
                          </button>
                        </div>

                        {isUpdating && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-sage-700 animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Updating...</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right side Actions (Edit & Delete for Admin view) */}
                  {showActions && (
                    <div className="flex sm:flex-col lg:flex-row items-center gap-2 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-charcoal-border/40 justify-stretch sm:justify-start shrink-0 w-full sm:w-auto">
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(booking)}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium text-charcoal bg-sage-50 hover:bg-sage-100 active:scale-95 rounded-xl sm:rounded-lg border border-sage-200 transition-all shadow-soft-xs"
                          aria-label={`Edit booking for ${booking.customer_name}`}
                        >
                          <Edit2 className="w-3.5 h-3.5 text-sage-700" />
                          <span>Edit</span>
                        </button>
                      )}

                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => setDeletingBooking(booking)}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 active:scale-95 rounded-xl sm:rounded-lg border border-red-200/60 transition-all shadow-soft-xs"
                          aria-label={`Delete booking for ${booking.customer_name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingBooking)}
        title="Delete Booking"
        message={`Are you sure you want to delete the booking for ${deletingBooking?.customer_name}? This action cannot be undone.`}
        confirmLabel="Delete Booking"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingBooking(null)}
      />
    </div>
  );
}

