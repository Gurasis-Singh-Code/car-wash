export type DetailerStatus = 'active' | 'inactive';

export interface Detailer {
  id: string;
  name: string;
  status: DetailerStatus;
  created_at: string;
  /**
   * The Supabase Auth account that signs into the detailer portal as this
   * person. Null until an admin links one; a detailer with no login is still a
   * perfectly valid roster entry that can be assigned bookings.
   */
  auth_user_id?: string | null;
  /** The email of that login, kept here so the roster can show who is linked. */
  email?: string | null;
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
