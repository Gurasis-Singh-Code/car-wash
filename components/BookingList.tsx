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
} from 'lucide-react';

interface BookingListProps {
  bookings: Booking[];
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
  showActions?: boolean;
  onEdit?: (booking: Booking) => void;
  onDelete?: (id: string) => void;
}

export default function BookingList({
  bookings = [],
  title = 'Scheduled Bookings',
  subtitle,
  emptyMessage = 'No bookings scheduled yet',
  showActions = false,
  onEdit,
  onDelete,
}: BookingListProps) {
  const [deletingBooking, setDeletingBooking] = useState<Booking | null>(null);

  // Sort bookings by date and time ascending
  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => {
      const dateTimeA = `${a.booking_date} ${a.booking_time}`;
      const dateTimeB = `${b.booking_date} ${b.booking_time}`;
      return dateTimeA.localeCompare(dateTimeB);
    });
  }, [bookings]);

  const handleConfirmDelete = () => {
    if (deletingBooking && onDelete) {
      onDelete(deletingBooking.id);
      setDeletingBooking(null);
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
    // If format is HH:MM or HH:MM:SS, format to 12-hour AM/PM
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
      // Format YYYY-MM-DD to readable date
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
    <div className="w-full">
      {/* Header section */}
      {(title || subtitle) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-6">
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
          {sortedBookings.length > 0 && (
            <div className="text-xs text-charcoal-muted font-medium bg-sage-50 px-3 py-1 rounded-full w-fit border border-sage-100">
              {sortedBookings.length} {sortedBookings.length === 1 ? 'appointment' : 'appointments'}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {sortedBookings.length === 0 ? (
        <div className="bg-white rounded-xl p-8 sm:p-12 text-center border border-charcoal-border/60 shadow-soft-sm">
          <div className="w-12 h-12 rounded-2xl bg-sage-50 text-sage-600 flex items-center justify-center mx-auto mb-4 border border-sage-100">
            <CalendarX className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-charcoal mb-1">
            {emptyMessage}
          </h3>
          <p className="text-xs sm:text-sm text-charcoal-muted max-w-sm mx-auto">
            Appointments will appear here in chronological order once they are scheduled.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {sortedBookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-white rounded-xl p-4 sm:p-5 border border-charcoal-border/60 shadow-soft-sm hover:shadow-soft-md hover:border-sage-300/80 transition-all duration-200"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                {/* Left & Middle details */}
                <div className="flex-1 space-y-3">
                  {/* Row 1: Customer Name + Phone + Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-charcoal tracking-tight">
                      {booking.customer_name}
                    </h3>

                    {/* Client Phone Link */}
                    {booking.client_no && (
                      <a
                        href={`tel:${booking.client_no.replace(/[^0-9+]/g, '')}`}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sage-50 text-sage-700 hover:text-sage-900 border border-sage-200/80 transition-colors"
                        title={`Call client: ${booking.client_no}`}
                      >
                        <Phone className="w-3 h-3 text-sage-600" />
                        <span>{booking.client_no}</span>
                      </a>
                    )}

                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sage-50 text-sage-800 border border-sage-200">
                      {SERVICE_LABELS[booking.service] || booking.service}
                    </span>

                    {/* Vehicle Type & Count */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-charcoal-surface text-charcoal-muted border border-charcoal-border/50">
                      <Car className="w-3 h-3 text-charcoal-muted" />
                      <span>
                        {booking.car_count && booking.car_count > 1 ? `${booking.car_count}x ` : ''}
                        {CAR_TYPE_LABELS[booking.car_type] || booking.car_type}
                      </span>
                    </span>

                    {/* Assigned Detailer */}
                    {booking.assigned_detailer && booking.assigned_detailer !== 'Unassigned' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200/60">
                        <UserCheck className="w-3 h-3 text-purple-600" />
                        <span>{booking.assigned_detailer}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                        <UserCheck className="w-3 h-3 text-amber-600" />
                        <span>Unassigned</span>
                      </span>
                    )}

                    {getStatusBadge(booking.status)}
                  </div>

                  {/* Row 2: Date, Time, Address */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-charcoal-muted">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-sage-600 shrink-0" />
                      <span className="font-medium text-charcoal">
                        {formatDisplayDate(booking.booking_date)}
                      </span>
                      <span className="text-charcoal-border">|</span>
                      <Clock className="w-3.5 h-3.5 text-sage-600 shrink-0" />
                      <span>{formatDisplayTime(booking.booking_time)}</span>
                    </div>

                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-sage-600 shrink-0" />
                      <span className="truncate" title={booking.address}>
                        {booking.address}
                      </span>
                    </div>
                  </div>

                  {/* Row 3: Utilities on site */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                        booking.has_power
                          ? 'bg-amber-50 text-amber-800 border border-amber-200/70'
                          : 'bg-charcoal-surface/60 text-charcoal-light border border-charcoal-border/40'
                      }`}
                    >
                      <Zap className="w-3 h-3 text-amber-600" />
                      {booking.has_power ? 'Power On-Site' : 'No Power'}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                        booking.has_water
                          ? 'bg-sky-50 text-sky-800 border border-sky-200/70'
                          : 'bg-charcoal-surface/60 text-charcoal-light border border-charcoal-border/40'
                      }`}
                    >
                      <Droplet className="w-3 h-3 text-sky-600" />
                      {booking.has_water ? 'Water On-Site' : 'No Water'}
                    </span>
                  </div>
                </div>

                {/* Right side Actions (for Admin view) */}
                {showActions && (
                  <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-charcoal-border/40 justify-end shrink-0">
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(booking)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-charcoal bg-sage-50 hover:bg-sage-100 rounded-lg border border-sage-200 transition-colors"
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
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200/60 transition-colors"
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
          ))}
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
