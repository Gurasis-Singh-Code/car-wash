import { supabase, isSupabaseConfigured } from './supabase';
import { Availability, DayOfWeek } from '@/types/availability';

function decodeAvailabilityFromDb(row: any): Availability {
  return {
    id: row.id,
    detailer_id: row.detailer_id,
    day_of_week: row.day_of_week,
    start_time: row.start_time,
    end_time: row.end_time,
  };
}

/**
 * Every detailer's weekly hours, indexed by detailer and then by day so the
 * roster can render seven rows per person without searching a flat list.
 *
 * One query for the whole team rather than one per detailer: the table holds at
 * most seven rows per person, so even a large roster is a small read, and it
 * keeps the admin page's existing "load everything, then filter in memory"
 * shape.
 *
 * Read-only by design. The dashboard shows this schedule; only the detailer
 * changes it, from their own app.
 */
export async function getAvailabilityByDetailer(): Promise<
  Record<string, Partial<Record<DayOfWeek, Availability>>>
> {
  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] Credentials not configured. Returning empty availability.');
    return {};
  }

  const { data, error } = await supabase
    .from('detailer_availability')
    .select('id, detailer_id, day_of_week, start_time, end_time')
    .order('detailer_id', { ascending: true })
    .order('day_of_week', { ascending: true });

  if (error) {
    console.error('[Supabase getAvailabilityByDetailer error]:', error.message);
    throw new Error(error.message);
  }

  const byDetailer: Record<string, Partial<Record<DayOfWeek, Availability>>> = {};
  (data || []).forEach((row) => {
    const decoded = decodeAvailabilityFromDb(row);
    if (!byDetailer[decoded.detailer_id]) {
      byDetailer[decoded.detailer_id] = {};
    }
    byDetailer[decoded.detailer_id][decoded.day_of_week] = decoded;
  });

  return byDetailer;
}

/** Realtime subscription, so hours set on a phone appear here without a refresh. */
export function subscribeToAvailability(callback: () => void): () => void {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  const channelId = `realtime_availability_${Math.random().toString(36).substring(2, 9)}`;
  const channel = supabase
    .channel(channelId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'detailer_availability' },
      () => {
        callback();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
