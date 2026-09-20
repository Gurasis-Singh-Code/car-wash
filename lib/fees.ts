import { supabase, isSupabaseConfigured } from './supabase';
import { BookingFee } from '@/types/fee';

function decodeFee(row: any): BookingFee {
  const d = Array.isArray(row.detailers) ? row.detailers[0] : row.detailers;
  const b = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings;
  return {
    id: row.id,
    booking_id: row.booking_id,
    detailer_id: row.detailer_id,
    service: row.service,
    customer_total: Number(row.customer_total ?? 0),
    fee_amount: Number(row.fee_amount ?? 0),
    pet_hair_fee: Number(row.pet_hair_fee ?? 0),
    status: row.status,
    completed_on: row.completed_on,
    week_start: row.week_start,
    paid_at: row.paid_at ?? null,
    paid_note: row.paid_note ?? null,
    detailer_name: d?.name,
    customer_name: b?.customer_name,
  };
}

/** Every fee on the books, newest week first. Admin-only by RLS. */
export async function getFees(): Promise<BookingFee[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('booking_fees')
    .select('*, detailers ( name ), bookings ( customer_name )')
    .order('week_start', { ascending: false })
    .order('completed_on', { ascending: false });
  if (error) {
    console.error('[getFees]', error.message);
    throw new Error(error.message);
  }
  return (data || []).map(decodeFee);
}

/** Settle every owed fee for one detailer's week. Returns how many rows moved. */
export async function markWeekPaid(detailerId: string, weekStart: string, note?: string): Promise<number> {
  const { data, error } = await supabase.rpc('admin_mark_week_paid', {
    p_detailer_id: detailerId,
    p_week_start: weekStart,
    p_note: note || null,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

/** Reverse a week marked paid by mistake. */
export async function markWeekOwed(detailerId: string, weekStart: string): Promise<number> {
  const { data, error } = await supabase.rpc('admin_mark_week_owed', {
    p_detailer_id: detailerId,
    p_week_start: weekStart,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export interface DetailerWeek {
  detailer_id: string;
  detailer_name: string;
  week_start: string;
  fees: BookingFee[];
  collected: number;
  owed: number;
  paid: number;
}

/** Group fees by detailer and invoice week, newest week first. */
export function groupByDetailerWeek(fees: BookingFee[]): DetailerWeek[] {
  const map = new Map<string, DetailerWeek>();
  for (const f of fees) {
    const key = `${f.detailer_id}|${f.week_start}`;
    let g = map.get(key);
    if (!g) {
      g = {
        detailer_id: f.detailer_id,
        detailer_name: f.detailer_name || 'Unknown',
        week_start: f.week_start,
        fees: [],
        collected: 0,
        owed: 0,
        paid: 0,
      };
      map.set(key, g);
    }
    g.fees.push(f);
    g.collected += f.customer_total;
    if (f.status === 'paid') g.paid += f.fee_amount;
    else g.owed += f.fee_amount;
  }
  return Array.from(map.values()).sort((a, b) =>
    a.week_start === b.week_start ? a.detailer_name.localeCompare(b.detailer_name) : a.week_start < b.week_start ? 1 : -1
  );
}
