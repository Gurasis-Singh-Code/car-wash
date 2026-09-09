import { supabase, isSupabaseConfigured } from './supabase';
import { Payout, PayoutStatus } from '@/types/payout';
import { SERVICE_LABELS } from '@/types/booking';

function decodePayoutFromDb(row: any): Payout {
  // PostgREST returns an embedded one-to-one relation as an object, but some
  // join shapes come back as a single-element array.
  const detailer = Array.isArray(row.detailers) ? row.detailers[0] : row.detailers;
  const booking = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings;

  return {
    id: row.id,
    detailer_id: row.detailer_id,
    booking_id: row.booking_id ?? null,
    amount: Number(row.amount ?? 0),
    status: row.status,
    earned_on: row.earned_on,
    paid_at: row.paid_at ?? null,
    notes: row.notes || undefined,
    created_at: row.created_at,
    detailer_name: detailer?.name,
    booking_label: booking
      ? `${SERVICE_LABELS[booking.service] || booking.service} · ${booking.customer_name}`
      : undefined,
  };
}

const PAYOUT_SELECT =
  'id, detailer_id, booking_id, amount, status, earned_on, paid_at, notes, created_at,' +
  ' detailers ( name ), bookings ( customer_name, service )';

/** Every payout, newest earning date first. */
export async function getPayouts(): Promise<Payout[]> {
  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] Credentials not configured. Returning empty payouts.');
    return [];
  }

  const { data, error } = await supabase
    .from('detailer_payouts')
    .select(PAYOUT_SELECT)
    .order('earned_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase getPayouts error]:', error.message);
    throw new Error(error.message);
  }

  return (data || []).map(decodePayoutFromDb);
}

export interface PayoutInput {
  detailer_id: string;
  booking_id?: string | null;
  amount: number;
  status: PayoutStatus;
  earned_on: string;
  notes?: string;
}

export async function addPayout(input: PayoutInput): Promise<Payout> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set your credentials in .env.local');
  }

  const { data, error } = await supabase
    .from('detailer_payouts')
    .insert([
      {
        detailer_id: input.detailer_id,
        booking_id: input.booking_id || null,
        amount: input.amount,
        status: input.status,
        earned_on: input.earned_on,
        paid_at: input.status === 'paid' ? new Date().toISOString() : null,
        notes: input.notes?.trim() || null,
      },
    ])
    .select(PAYOUT_SELECT)
    .single();

  if (error) {
    console.error('[Supabase addPayout error]:', error.message);
    // A partial unique index stops the same job being paid to the same detailer
    // twice, which would otherwise silently double their earnings total.
    if (error.code === '23505') {
      throw new Error('That detailer already has a payout recorded for this booking.');
    }
    throw new Error(error.message);
  }

  return decodePayoutFromDb(data);
}

/** Flip a payout between pending and paid, stamping paid_at accordingly. */
export async function updatePayoutStatus(id: string, status: PayoutStatus): Promise<Payout> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set your credentials in .env.local');
  }

  const { data, error } = await supabase
    .from('detailer_payouts')
    .update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null })
    .eq('id', id)
    .select(PAYOUT_SELECT)
    .single();

  if (error) {
    console.error('[Supabase updatePayoutStatus error]:', error.message);
    throw new Error(error.message);
  }

  return decodePayoutFromDb(data);
}

export async function deletePayout(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set your credentials in .env.local');
  }

  const { error } = await supabase.from('detailer_payouts').delete().eq('id', id);

  if (error) {
    console.error('[Supabase deletePayout error]:', error.message);
    throw new Error(error.message);
  }
}
