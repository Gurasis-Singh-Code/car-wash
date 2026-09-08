export type DetailerStatus = 'active' | 'inactive';

export interface Detailer {
  id: string;
  name: string;
  status: DetailerStatus;
  created_at: string;
}

export const DETAILER_STATUS_LABELS: Record<DetailerStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
};

/** Pill styling, matching the status badges already used on booking cards. */
export const DETAILER_STATUS_STYLES: Record<DetailerStatus, string> = {
  active: 'bg-sage-100 text-sage-800 border-sage-200/80',
  inactive: 'bg-charcoal-surface text-charcoal-muted border-charcoal-border/50',
};
