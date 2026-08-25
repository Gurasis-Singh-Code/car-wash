export type CarType = 'sedan' | 'hatchback' | 'suv' | 'van' | 'mini_truck' | 'other';
export type ServiceType =
  | 'interior_silver'
  | 'interior_gold'
  | 'full_silver'
  | 'full_gold'
  | 'interior'
  | 'full';
export type BookingStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Booking {
  id: string;
  customer_name: string;
  client_no?: string;
  car_count?: number;
  assigned_detailer?: string;
  service: ServiceType;
  address: string;
  booking_date: string;
  booking_time: string;
  car_type: CarType;
  has_power: boolean;
  has_water: boolean;
  status: BookingStatus;
}

export interface BookingStats {
  today_count: number;
  week_count: number;
  upcoming_count: number;
  completed_count: number;
}

export const SERVICE_LABELS: Record<string, string> = {
  interior_silver: 'Interior Silver',
  interior_gold: 'Interior Gold',
  full_silver: 'Full Silver',
  full_gold: 'Full Gold',
  interior: 'Interior Detailing',
  full: 'Full Detailing',
};

export const CAR_TYPE_LABELS: Record<CarType, string> = {
  sedan: 'Sedan',
  hatchback: 'Hatchback',
  suv: 'SUV',
  van: 'Van',
  mini_truck: 'Mini Truck',
  other: 'Other',
};

export const STATUS_LABELS: Record<BookingStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
