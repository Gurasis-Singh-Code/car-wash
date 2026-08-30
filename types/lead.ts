import { CarType, ServiceType } from './booking';

export type LeadStatus =
  | 'new'
  | 'in_progress'
  | 'details_collected'
  | 'confirmed'
  | 'converted'
  | 'lost';

export interface Lead {
  id: string;
  instagram_user_id: string;
  instagram_username?: string;
  customer_name?: string;
  client_no?: string;
  email?: string;
  car_type?: CarType;
  car_count?: number;
  vehicle_make_model?: string;
  service?: ServiceType;
  pet_hair: boolean;
  address?: string;
  booking_date?: string;
  booking_time?: string;
  has_power?: boolean;
  has_water?: boolean;
  price?: number;
  notes?: string;
  last_message?: string;
  message_count: number;
  lead_status: LeadStatus;
  booking_id?: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

export interface LeadStats {
  total: number;
  new_count: number;
  in_progress_count: number;
  details_collected_count: number;
  confirmed_count: number;
  converted_count: number;
  lost_count: number;
  conversion_rate: number;
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  in_progress: 'In Progress',
  details_collected: 'Details Collected',
  confirmed: 'Confirmed',
  converted: 'Converted',
  lost: 'Lost',
};

/**
 * The funnel order leads move through, used for ordering tabs and the pipeline bar.
 */
export const LEAD_STATUS_ORDER: LeadStatus[] = [
  'new',
  'in_progress',
  'details_collected',
  'confirmed',
  'converted',
  'lost',
];

interface LeadStatusStyle {
  /** Badge / pill styling */
  badge: string;
  /** Solid fill used for the pipeline bar and active tab */
  bar: string;
  /** Active filter tab styling */
  tab: string;
  dot: string;
}

export const LEAD_STATUS_STYLES: Record<LeadStatus, LeadStatusStyle> = {
  new: {
    badge: 'bg-sky-50 text-sky-700 border-sky-200/70',
    bar: 'bg-sky-500',
    tab: 'bg-sky-100 text-sky-900 border-sky-300',
    dot: 'bg-sky-500',
  },
  in_progress: {
    badge: 'bg-amber-50 text-amber-800 border-amber-200/70',
    bar: 'bg-amber-500',
    tab: 'bg-amber-100 text-amber-900 border-amber-300',
    dot: 'bg-amber-500',
  },
  details_collected: {
    badge: 'bg-purple-50 text-purple-700 border-purple-200/70',
    bar: 'bg-purple-500',
    tab: 'bg-purple-100 text-purple-900 border-purple-300',
    dot: 'bg-purple-500',
  },
  confirmed: {
    badge: 'bg-sage-100 text-sage-800 border-sage-300/80',
    bar: 'bg-sage-500',
    tab: 'bg-sage-100 text-sage-900 border-sage-300',
    dot: 'bg-sage-500',
  },
  converted: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
    bar: 'bg-emerald-500',
    tab: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    dot: 'bg-emerald-500',
  },
  lost: {
    badge: 'bg-red-50 text-red-700 border-red-200/70',
    bar: 'bg-red-400',
    tab: 'bg-red-100 text-red-900 border-red-300',
    dot: 'bg-red-400',
  },
};
