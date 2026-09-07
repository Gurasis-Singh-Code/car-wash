export type CarType = 'sedan' | 'hatchback' | 'suv' | 'van' | 'mini_truck' | 'other';
export type ServiceType =
  | 'interior_silver'
  | 'interior_gold'
  | 'full_silver'
  | 'full_gold'
  | 'ceramic_tint'
  | 'nano_ceramic_tint'
  | 'interior'
  | 'full';
export type BookingStatus = 'scheduled' | 'completed' | 'cancelled';

/**
 * Which channel the job runs through: a mobile visit or an in-shop appointment.
 * Distinct from `source`, which records how the booking was acquired.
 */
export type ServiceLocation = 'mobile' | 'shop';

export interface Booking {
  id: string;
  customer_name: string;
  number?: string;
  client_no?: string;
  /** Numeric Instagram account ID, owned by the DM automation. Not linkable. */
  instagram_user_id?: string;
  /** Public Instagram @handle (stored without the leading "@"). */
  instagram_username?: string;
  /** Contact email. Suggested when booking, but never required. */
  email?: string;
  car_count?: number;
  assigned_detailer?: string;
  service: ServiceType;
  /** Mobile visit or in-shop job. Defaults to 'mobile' for pre-existing rows. */
  service_location?: ServiceLocation;
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
  ceramic_tint: 'Ceramic Tint',
  nano_ceramic_tint: 'Nano Ceramic Tint',
  interior: 'Interior Detailing',
  full: 'Full Detailing',
};

export const SERVICE_LOCATION_LABELS: Record<ServiceLocation, string> = {
  mobile: 'Mobile',
  shop: 'Shop',
};

/**
 * Services offered when creating a NEW booking, in dropdown order.
 *
 * Excludes the legacy 'interior' / 'full' values, which stay in ServiceType and
 * SERVICE_LABELS so any older row still renders. This list only controls what
 * can be picked going forward.
 */
export const BOOKABLE_SERVICES: ServiceType[] = [
  'interior_silver',
  'interior_gold',
  'full_silver',
  'full_gold',
  'ceramic_tint',
  'nano_ceramic_tint',
];

/**
 * Some services get a visually distinct card so they can be picked out of a long
 * list at a glance. Tint is a different job from detailing — different kit,
 * different prep — so it reads as indigo rather than the usual sage.
 *
 * Defined once here because the dashboard, the admin list and the overview
 * explorer all render the same booking; keeping the classes in one place is what
 * stops those three views drifting apart.
 */
const TINT_CARD =
  'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-300/80 dark:border-indigo-400/40 border-l-4 border-l-indigo-500 dark:border-l-indigo-400';
const TINT_BADGE = 'bg-indigo-100 text-indigo-800 border-indigo-300';
const TINT_ROW =
  'bg-indigo-50/70 dark:bg-indigo-500/10 hover:bg-indigo-100/70 dark:hover:bg-indigo-500/20';

const CARD_ACCENTS: Record<string, string> = {
  ceramic_tint: TINT_CARD,
  nano_ceramic_tint: TINT_CARD,
};

const BADGE_ACCENTS: Record<string, string> = {
  ceramic_tint: TINT_BADGE,
  nano_ceramic_tint: TINT_BADGE,
};

const ROW_ACCENTS: Record<string, string> = {
  ceramic_tint: TINT_ROW,
  nano_ceramic_tint: TINT_ROW,
};

export const DEFAULT_CARD_ACCENT =
  'bg-charcoal-card border-charcoal-border/60 hover:border-sage-300/80';
export const DEFAULT_SERVICE_BADGE = 'bg-sage-50 text-sage-800 border-sage-200';
export const DEFAULT_ROW_ACCENT = 'hover:bg-sage-50/40';

/** Card container classes for a booking, falling back to the standard card. */
export function serviceCardAccent(service?: string, fallback: string = DEFAULT_CARD_ACCENT): string {
  return (service && CARD_ACCENTS[service]) || fallback;
}

/** Service pill classes, falling back to the standard sage pill. */
export function serviceBadgeAccent(service?: string): string {
  return (service && BADGE_ACCENTS[service]) || DEFAULT_SERVICE_BADGE;
}

/** Table row classes for the overview explorer. */
export function serviceRowAccent(service?: string): string {
  return (service && ROW_ACCENTS[service]) || DEFAULT_ROW_ACCENT;
}

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
