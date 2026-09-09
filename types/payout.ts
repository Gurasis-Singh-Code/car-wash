export type PayoutStatus = 'pending' | 'paid';

/**
 * What one detailer is owed for one job.
 *
 * Never derived from bookings.price. The rule that no expense and no detailer
 * pay is ever auto-calculated applies here too: every line is typed in, so what
 * the customer paid and what the detailer earns stay independent numbers.
 *
 * Payouts are also deliberately NOT rolled into the expenses table and so do not
 * move the Finance page's profit figures. Recording pay and recording the cost
 * of that pay are two separate acts; making one imply the other would double
 * count the moment someone also enters a wages expense.
 */
export interface Payout {
  id: string;
  detailer_id: string;
  booking_id: string | null;
  amount: number;
  status: PayoutStatus;
  earned_on: string;
  paid_at: string | null;
  notes?: string;
  created_at: string;
  /** Joined for display. */
  detailer_name?: string;
  booking_label?: string;
}

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
};

export const PAYOUT_STATUS_STYLES: Record<PayoutStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200/60',
  paid: 'bg-sage-100 text-sage-800 border-sage-200/80',
};
