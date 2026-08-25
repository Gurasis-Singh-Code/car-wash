'use client';

import React, { useState } from 'react';
import {
  Booking,
  CarType,
  ServiceType,
  SERVICE_LABELS,
  CAR_TYPE_LABELS,
} from '@/types/booking';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Car,
  Zap,
  Droplet,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Phone,
  UserCheck,
  Hash,
} from 'lucide-react';

export type BookingFormData = Omit<Booking, 'id' | 'status'>;

interface BookingFormProps {
  onSubmit?: (data: BookingFormData) => void | Promise<void>;
  initialData?: Partial<BookingFormData>;
  submitButtonLabel?: string;
  isEditing?: boolean;
}

// 9:00 AM to 7:00 PM with 30-minute intervals
const TIME_SLOTS = [
  { value: '09:00:00', label: '9:00 AM' },
  { value: '09:30:00', label: '9:30 AM' },
  { value: '10:00:00', label: '10:00 AM' },
  { value: '10:30:00', label: '10:30 AM' },
  { value: '11:00:00', label: '11:00 AM' },
  { value: '11:30:00', label: '11:30 AM' },
  { value: '12:00:00', label: '12:00 PM' },
  { value: '12:30:00', label: '12:30 PM' },
  { value: '13:00:00', label: '1:00 PM' },
  { value: '13:30:00', label: '1:30 PM' },
  { value: '14:00:00', label: '2:00 PM' },
  { value: '14:30:00', label: '2:30 PM' },
  { value: '15:00:00', label: '3:00 PM' },
  { value: '15:30:00', label: '3:30 PM' },
  { value: '16:00:00', label: '4:00 PM' },
  { value: '16:30:00', label: '4:30 PM' },
  { value: '17:00:00', label: '5:00 PM' },
  { value: '17:30:00', label: '5:30 PM' },
  { value: '18:00:00', label: '6:00 PM' },
  { value: '18:30:00', label: '6:30 PM' },
  { value: '19:00:00', label: '7:00 PM' },
];

export default function BookingForm({
  onSubmit,
  initialData,
  submitButtonLabel = 'Create Booking',
  isEditing = false,
}: BookingFormProps) {
  // Get today in YYYY-MM-DD format for min date validation
  const todayDateString = new Date().toISOString().split('T')[0];

  const [customerName, setCustomerName] = useState(initialData?.customer_name || '');
  const [clientNo, setClientNo] = useState(initialData?.client_no || '');
  const [carCount, setCarCount] = useState<number>(initialData?.car_count || 1);
  const [assignedDetailer, setAssignedDetailer] = useState(
    initialData?.assigned_detailer === 'Unassigned' ? '' : (initialData?.assigned_detailer || '')
  );
  const [service, setService] = useState<ServiceType>(initialData?.service || 'interior_silver');
  const [address, setAddress] = useState(initialData?.address || '');
  const [bookingDate, setBookingDate] = useState(initialData?.booking_date || todayDateString);
  const [bookingTime, setBookingTime] = useState(initialData?.booking_time || '09:00:00');
  const [carType, setCarType] = useState<CarType>(initialData?.car_type || 'sedan');
  const [hasPower, setHasPower] = useState(initialData?.has_power ?? false);
  const [hasWater, setHasWater] = useState(initialData?.has_water ?? false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!customerName.trim()) {
      newErrors.customer_name = 'Customer name is required';
    }

    if (!address.trim()) {
      newErrors.address = 'Service address is required';
    }

    if (!bookingDate) {
      newErrors.booking_date = 'Booking date is required';
    } else if (bookingDate < todayDateString) {
      newErrors.booking_date = 'Booking date cannot be in the past';
    }

    if (!bookingTime) {
      newErrors.booking_time = 'Booking time is required';
    }

    if (!carCount || carCount < 1) {
      newErrors.car_count = 'Must specify at least 1 vehicle';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);

    if (!validateForm()) {
      return;
    }

    const payload: BookingFormData = {
      customer_name: customerName.trim(),
      client_no: clientNo.trim() || undefined,
      car_count: Number(carCount) || 1,
      assigned_detailer: assignedDetailer.trim() || 'Unassigned',
      service,
      address: address.trim(),
      booking_date: bookingDate,
      booking_time: bookingTime,
      car_type: carType,
      has_power: hasPower,
      has_water: hasWater,
    };

    setIsSubmitting(true);

    try {
      if (onSubmit) {
        await onSubmit(payload);
      } else {
        console.log('[BookingForm submit]', payload);
      }

      setSuccessMessage(
        isEditing
          ? 'Booking updated successfully!'
          : 'New booking created successfully!'
      );

      // If creating new (not editing), clear form
      if (!isEditing) {
        setCustomerName('');
        setClientNo('');
        setCarCount(1);
        setAssignedDetailer('');
        setAddress('');
        setService('interior_silver');
        setCarType('sedan');
        setBookingDate(todayDateString);
        setBookingTime('09:00:00');
        setHasPower(false);
        setHasWater(false);
        setErrors({});
      }

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      setErrors({ form: err?.message || 'An unexpected error occurred while saving.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-7 border border-charcoal-border/60 shadow-soft-md w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-charcoal-border/40">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-charcoal tracking-tight flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-sage-600" />
            <span>{isEditing ? 'Edit Appointment' : 'New Appointment'}</span>
          </h2>
          <p className="text-xs text-charcoal-muted mt-0.5">
            {isEditing
              ? 'Update appointment details, client info, and assignments'
              : 'Enter customer, vehicle, and dispatch details'}
          </p>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* General Form Error */}
      {errors.form && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errors.form}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Row 1: Customer Name & Client Phone / No. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Customer Name */}
          <div>
            <label
              htmlFor="customer_name"
              className="block text-xs font-semibold uppercase tracking-wider text-charcoal mb-1.5"
            >
              Customer Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-muted">
                <User className="w-4 h-4 text-sage-600" />
              </div>
              <input
                id="customer_name"
                type="text"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  if (errors.customer_name) setErrors((prev) => ({ ...prev, customer_name: '' }));
                }}
                placeholder="e.g. Sarah Jenkins"
                className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm bg-[#FAF9F6] border ${
                  errors.customer_name
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-charcoal-border focus:border-sage-500'
                } text-charcoal placeholder:text-charcoal-light/70 focus:bg-white transition-colors`}
              />
            </div>
            {errors.customer_name && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.customer_name}
              </p>
            )}
          </div>

          {/* Client No. / Phone */}
          <div>
            <label
              htmlFor="client_no"
              className="block text-xs font-semibold uppercase tracking-wider text-charcoal mb-1.5"
            >
              Client No. / Phone
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-muted">
                <Phone className="w-4 h-4 text-sage-600" />
              </div>
              <input
                id="client_no"
                type="tel"
                value={clientNo}
                onChange={(e) => setClientNo(e.target.value)}
                placeholder="e.g. (555) 019-2834"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm bg-[#FAF9F6] border border-charcoal-border text-charcoal placeholder:text-charcoal-light/70 focus:border-sage-500 focus:bg-white transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Row 2: Service Package & Assigned Detailer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Service Type */}
          <div>
            <label
              htmlFor="service"
              className="block text-xs font-semibold uppercase tracking-wider text-charcoal mb-1.5"
            >
              Service Package <span className="text-red-500">*</span>
            </label>
            <select
              id="service"
              value={service}
              onChange={(e) => setService(e.target.value as ServiceType)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAF9F6] border border-charcoal-border text-charcoal focus:border-sage-500 focus:bg-white transition-colors cursor-pointer"
            >
              <option value="interior_silver">{SERVICE_LABELS.interior_silver}</option>
              <option value="interior_gold">{SERVICE_LABELS.interior_gold}</option>
              <option value="full_silver">{SERVICE_LABELS.full_silver}</option>
              <option value="full_gold">{SERVICE_LABELS.full_gold}</option>
            </select>
          </div>

          {/* Assigned Detailer */}
          <div>
            <label
              htmlFor="assigned_detailer"
              className="block text-xs font-semibold uppercase tracking-wider text-charcoal mb-1.5"
            >
              Assign Detailer
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-muted">
                <UserCheck className="w-4 h-4 text-sage-600" />
              </div>
              <input
                id="assigned_detailer"
                type="text"
                value={assignedDetailer}
                onChange={(e) => setAssignedDetailer(e.target.value)}
                placeholder="e.g. Name of Detailer"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm bg-[#FAF9F6] border border-charcoal-border text-charcoal placeholder:text-charcoal-light/70 focus:border-sage-500 focus:bg-white transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Row 3: Vehicle Type & Number of Cars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Car Type */}
          <div>
            <label
              htmlFor="car_type"
              className="block text-xs font-semibold uppercase tracking-wider text-charcoal mb-1.5"
            >
              Vehicle Type <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-muted">
                <Car className="w-4 h-4 text-sage-600" />
              </div>
              <select
                id="car_type"
                value={carType}
                onChange={(e) => setCarType(e.target.value as CarType)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm bg-[#FAF9F6] border border-charcoal-border text-charcoal focus:border-sage-500 focus:bg-white transition-colors cursor-pointer"
              >
                <option value="sedan">{CAR_TYPE_LABELS.sedan}</option>
                <option value="hatchback">{CAR_TYPE_LABELS.hatchback}</option>
                <option value="suv">{CAR_TYPE_LABELS.suv}</option>
                <option value="van">{CAR_TYPE_LABELS.van}</option>
                <option value="mini_truck">{CAR_TYPE_LABELS.mini_truck}</option>
                <option value="other">{CAR_TYPE_LABELS.other}</option>
              </select>
            </div>
          </div>

          {/* Number of Cars */}
          <div>
            <label
              htmlFor="car_count"
              className="block text-xs font-semibold uppercase tracking-wider text-charcoal mb-1.5"
            >
              No. of Cars / Vehicles <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-muted">
                <Hash className="w-4 h-4 text-sage-600" />
              </div>
              <input
                id="car_count"
                type="number"
                min={1}
                max={20}
                value={carCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setCarCount(isNaN(val) ? 1 : Math.max(1, val));
                  if (errors.car_count) setErrors((prev) => ({ ...prev, car_count: '' }));
                }}
                className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm bg-[#FAF9F6] border ${
                  errors.car_count
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-charcoal-border focus:border-sage-500'
                } text-charcoal focus:bg-white transition-colors`}
              />
            </div>
            {errors.car_count && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.car_count}
              </p>
            )}
          </div>
        </div>

        {/* Row 4: Service Address */}
        <div>
          <label
            htmlFor="address"
            className="block text-xs font-semibold uppercase tracking-wider text-charcoal mb-1.5"
          >
            Service Address <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-muted">
              <MapPin className="w-4 h-4 text-sage-600" />
            </div>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (errors.address) setErrors((prev) => ({ ...prev, address: '' }));
              }}
              placeholder="e.g. 742 Evergreen Terrace, Springfield"
              className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm bg-[#FAF9F6] border ${
                errors.address
                  ? 'border-red-400 focus:border-red-500'
                  : 'border-charcoal-border focus:border-sage-500'
              } text-charcoal placeholder:text-charcoal-light/70 focus:bg-white transition-colors`}
            />
          </div>
          {errors.address && (
            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.address}
            </p>
          )}
        </div>

        {/* Row 5: Date and Time (2-col grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Date Picker */}
          <div>
            <label
              htmlFor="booking_date"
              className="block text-xs font-semibold uppercase tracking-wider text-charcoal mb-1.5"
            >
              Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="booking_date"
                type="date"
                min={todayDateString}
                value={bookingDate}
                onChange={(e) => {
                  setBookingDate(e.target.value);
                  if (errors.booking_date) setErrors((prev) => ({ ...prev, booking_date: '' }));
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAF9F6] border ${
                  errors.booking_date
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-charcoal-border focus:border-sage-500'
                } text-charcoal focus:bg-white transition-colors cursor-pointer`}
              />
            </div>
            {errors.booking_date && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.booking_date}
              </p>
            )}
          </div>

          {/* Time Selector */}
          <div>
            <label
              htmlFor="booking_time"
              className="block text-xs font-semibold uppercase tracking-wider text-charcoal mb-1.5"
            >
              Time Slot <span className="text-red-500">*</span>
            </label>
            <select
              id="booking_time"
              value={bookingTime}
              onChange={(e) => {
                setBookingTime(e.target.value);
                if (errors.booking_time) setErrors((prev) => ({ ...prev, booking_time: '' }));
              }}
              className={`w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAF9F6] border ${
                errors.booking_time
                  ? 'border-red-400 focus:border-red-500'
                  : 'border-charcoal-border focus:border-sage-500'
              } text-charcoal focus:bg-white transition-colors cursor-pointer`}
            >
              {TIME_SLOTS.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
            {errors.booking_time && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.booking_time}
              </p>
            )}
          </div>
        </div>

        {/* On-site Utility Toggles */}
        <div className="pt-2 space-y-3">
          <span className="block text-xs font-semibold uppercase tracking-wider text-charcoal">
            On-Site Utilities
          </span>

          {/* Power toggle */}
          <label className="flex items-center justify-between p-3 rounded-xl bg-[#FAF9F6] border border-charcoal-border/70 hover:border-sage-300 transition-colors cursor-pointer">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  hasPower ? 'bg-amber-100 text-amber-700' : 'bg-charcoal-border/50 text-charcoal-muted'
                }`}
              >
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-charcoal block">
                  Power Available On-Site
                </span>
                <span className="text-[11px] text-charcoal-muted block">
                  Standard electrical outlet accessible for equipment
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={hasPower}
              onChange={(e) => setHasPower(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-6 bg-charcoal-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-charcoal-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sage-500 relative"></div>
          </label>

          {/* Water toggle */}
          <label className="flex items-center justify-between p-3 rounded-xl bg-[#FAF9F6] border border-charcoal-border/70 hover:border-sage-300 transition-colors cursor-pointer">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  hasWater ? 'bg-sky-100 text-sky-700' : 'bg-charcoal-border/50 text-charcoal-muted'
                }`}
              >
                <Droplet className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-charcoal block">
                  Water Available On-Site
                </span>
                <span className="text-[11px] text-charcoal-muted block">
                  Outdoor spigot or hose connection available
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={hasWater}
              onChange={(e) => setHasWater(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-6 bg-charcoal-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-charcoal-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sage-500 relative"></div>
          </label>
        </div>

        {/* Submit button */}
        <div className="pt-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl bg-sage-500 hover:bg-sage-600 active:scale-[0.99] text-white font-medium text-sm shadow-soft-sm transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span>Saving Appointment...</span>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                <span>{submitButtonLabel}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
