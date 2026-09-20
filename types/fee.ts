export type FeeStatus = 'owed' | 'paid';

/**
 * One completed job, as the money sees it. From `booking_fees`, written by a
 * database trigger the moment a booking is marked completed.
 *
 * The detailer collected `customer_total` in full at the job and owes Absolute
 * `fee_amount`. That fee is the business's revenue on the job - the rest never
 * passes through the business at all. Fees are invoiced weekly by `week_start`
 * (a Monday) and settled a week at a time.
 */
export interface BookingFee {
  id: string;
  booking_id: string;
  detailer_id: string;
  service: string;
  customer_total: number;
  /** Included in fee_amount. $10 of the $25 pet hair add-on is Absolute's. */
  pet_hair_fee: number;
  fee_amount: number;
  status: FeeStatus;
  completed_on: string;
  week_start: string;
  /** 7 days after the week ends. Set by the database. */
  due_on: string;
  paid_at: string | null;
  paid_note: string | null;
  /** Joined for display. */
  detailer_name?: string;
  customer_name?: string;
}

export const FEE_STATUS_LABELS: Record<FeeStatus, string> = {
  owed: 'Owed',
  paid: 'Paid',
};

export const FEE_STATUS_STYLES: Record<FeeStatus, string> = {
  owed: 'bg-amber-50 text-amber-700 border-amber-200/60',
  paid: 'bg-sage-100 text-sage-800 border-sage-200/80',
};
