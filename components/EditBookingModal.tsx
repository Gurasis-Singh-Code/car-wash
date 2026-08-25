'use client';

import React from 'react';
import { Booking } from '@/types/booking';
import BookingForm, { BookingFormData } from './BookingForm';
import { X } from 'lucide-react';

interface EditBookingModalProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedData: BookingFormData) => void;
}

export default function EditBookingModal({
  booking,
  isOpen,
  onClose,
  onSave,
}: EditBookingModalProps) {
  if (!isOpen || !booking) return null;

  const handleSubmit = (data: BookingFormData) => {
    onSave(data);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div
        className="relative bg-white w-full max-w-[500px] rounded-2xl shadow-soft-lg border border-charcoal-border my-8 animate-scale-up"
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-charcoal-muted hover:text-charcoal p-1.5 rounded-lg hover:bg-sage-50 transition-colors z-10"
          aria-label="Close edit dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-2 sm:p-4">
          <BookingForm
            isEditing={true}
            initialData={booking}
            submitButtonLabel="Save Changes"
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
}
