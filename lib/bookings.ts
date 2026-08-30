import { supabase, isSupabaseConfigured } from './supabase';
import { Booking, BookingStats, ServiceType } from '@/types/booking';

/**
 * Decodes a raw booking row from Supabase into the application's Booking type.
 * Ensures all dedicated database columns (customer_name, number, client_no,
 * instagram_user_id, car_count, assigned_detailer, service, address, etc.)
 * are mapped cleanly without any address contamination.
 */
function decodeBookingFromDb(row: any): Booking {
  const rawAddr = row.address || '';
  // Sanitize address in case legacy rows had embedded HTML comments
  const cleanAddress = rawAddr.replace(/\n?<!--meta:[\s\S]*?-->/g, '').trim();

  // Try extracting legacy metadata if row was created under old address-encoding scheme
  let legacyMeta: any = {};
  const match = rawAddr.match(/\n?<!--meta:([\s\S]*?)-->/);
  if (match) {
    try {
      legacyMeta = JSON.parse(match[1]);
    } catch (e) {
      console.warn('[decodeBookingFromDb legacy metadata parse error]:', e);
    }
  }

  const phone = row.number || row.client_no || legacyMeta.number || legacyMeta.client_no || undefined;
  const instagram_user_id = row.instagram_user_id || legacyMeta.instagram_user_id || undefined;
  const car_count = row.car_count ?? legacyMeta.car_count ?? 1;
  const assigned_detailer = row.assigned_detailer || legacyMeta.assigned_detailer || 'Unassigned';

  return {
    id: row.id,
    customer_name: row.customer_name,
    number: phone,
    client_no: phone,
    instagram_user_id,
    car_count,
    assigned_detailer,
    service: row.service,
    address: cleanAddress,
    booking_date: row.booking_date,
    booking_time: row.booking_time,
    car_type: row.car_type,
    has_power: Boolean(row.has_power),
    has_water: Boolean(row.has_water),
    status: row.status,
  };
}

/**
 * Fetch all bookings from Supabase, ordered by booking date and time.
 */
export async function getBookings(): Promise<Booking[]> {
  if (!isSupabaseConfigured()) {
    console.warn(
      '[Supabase] Credentials not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'
    );
    return [];
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('booking_date', { ascending: true })
    .order('booking_time', { ascending: true });

  if (error) {
    console.error('[Supabase getBookings error]:', error.message);
    throw new Error(error.message);
  }

  const rows = data || [];
  return rows.map(decodeBookingFromDb);
}

/**
 * Fetch upcoming scheduled bookings (status = 'scheduled'), ordered by date and time ascending.
 */
export async function getUpcomingBookings(): Promise<Booking[]> {
  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] Credentials not configured. Returning empty upcoming bookings.');
    return [];
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('status', 'scheduled')
    .order('booking_date', { ascending: true })
    .order('booking_time', { ascending: true });

  if (error) {
    console.error('[Supabase getUpcomingBookings error]:', error.message);
    throw new Error(error.message);
  }

  const rows = data || [];
  return rows.map(decodeBookingFromDb);
}

/**
 * Fetch summary statistics from the booking_stats view.
 */
export async function getStats(): Promise<BookingStats> {
  if (!isSupabaseConfigured()) {
    return {
      today_count: 0,
      week_count: 0,
      upcoming_count: 0,
      completed_count: 0,
    };
  }

  const { data, error } = await supabase
    .from('booking_stats')
    .select('*')
    .single();

  if (error) {
    console.error('[Supabase getStats error]:', error.message);
    return {
      today_count: 0,
      week_count: 0,
      upcoming_count: 0,
      completed_count: 0,
    };
  }

  return {
    today_count: Number(data?.today_count || 0),
    week_count: Number(data?.week_count || 0),
    upcoming_count: Number(data?.upcoming_count || 0),
    completed_count: Number(data?.completed_count || 0),
  };
}

function normalizeService(service?: ServiceType): ServiceType | undefined {
  if (!service) return service;
  if (service === 'interior') return 'interior_silver';
  if (service === 'full') return 'full_silver';
  return service;
}

/**
 * Add a new booking row to the bookings table.
 * Each piece of data is stored directly in its dedicated database column.
 */
export async function addBooking(
  data: Omit<Booking, 'id' | 'status'>
): Promise<Booking> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set your credentials in .env.local');
  }

  const phone = data.number?.trim() || data.client_no?.trim() || null;
  const instagramUserId = data.instagram_user_id?.trim() || null;
  const carCount = Number(data.car_count) || 1;
  const assignedDetailer = data.assigned_detailer?.trim() || 'Unassigned';
  const cleanAddress = (data.address || '').replace(/\n?<!--meta:[\s\S]*?-->/g, '').trim();

  const payload: any = {
    customer_name: data.customer_name.trim(),
    number: phone,
    client_no: phone,
    instagram_user_id: instagramUserId,
    car_count: carCount,
    assigned_detailer: assignedDetailer,
    service: normalizeService(data.service) || 'interior_silver',
    address: cleanAddress,
    booking_date: data.booking_date,
    booking_time: data.booking_time,
    car_type: data.car_type,
    has_power: Boolean(data.has_power),
    has_water: Boolean(data.has_water),
    status: 'scheduled',
  };

  const { data: created, error } = await supabase
    .from('bookings')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('[Supabase addBooking error]:', error.message);
    throw new Error(error.message);
  }

  return decodeBookingFromDb(created);
}

/**
 * Update an existing booking row.
 * Each piece of data is stored directly in its dedicated database column.
 */
export async function updateBooking(
  id: string,
  data: Partial<Booking>
): Promise<Booking> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set your credentials in .env.local');
  }

  const phone =
    data.number !== undefined
      ? (data.number?.trim() || null)
      : (data.client_no !== undefined ? (data.client_no?.trim() || null) : undefined);
  const instagramUserId =
    data.instagram_user_id !== undefined ? (data.instagram_user_id?.trim() || null) : undefined;
  const carCount = data.car_count !== undefined ? (Number(data.car_count) || 1) : undefined;
  const assignedDetailer =
    data.assigned_detailer !== undefined ? (data.assigned_detailer?.trim() || 'Unassigned') : undefined;
  const cleanAddress =
    data.address !== undefined
      ? (data.address || '').replace(/\n?<!--meta:[\s\S]*?-->/g, '').trim()
      : undefined;

  const updatePayload: any = {
    ...(data.customer_name !== undefined ? { customer_name: data.customer_name.trim() } : {}),
    ...(phone !== undefined ? { number: phone, client_no: phone } : {}),
    ...(instagramUserId !== undefined ? { instagram_user_id: instagramUserId } : {}),
    ...(carCount !== undefined ? { car_count: carCount } : {}),
    ...(assignedDetailer !== undefined ? { assigned_detailer: assignedDetailer } : {}),
    ...(data.service ? { service: normalizeService(data.service) } : {}),
    ...(cleanAddress !== undefined ? { address: cleanAddress } : {}),
    ...(data.booking_date !== undefined ? { booking_date: data.booking_date } : {}),
    ...(data.booking_time !== undefined ? { booking_time: data.booking_time } : {}),
    ...(data.car_type !== undefined ? { car_type: data.car_type } : {}),
    ...(data.has_power !== undefined ? { has_power: Boolean(data.has_power) } : {}),
    ...(data.has_water !== undefined ? { has_water: Boolean(data.has_water) } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
  };

  const { data: updated, error } = await supabase
    .from('bookings')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Supabase updateBooking error]:', error.message);
    throw new Error(error.message);
  }

  return decodeBookingFromDb(updated);
}

/**
 * Delete a booking row by ID.
 */
export async function deleteBooking(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set your credentials in .env.local');
  }

  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Supabase deleteBooking error]:', error.message);
    throw new Error(error.message);
  }
}

/**
 * Subscribe to realtime changes on the bookings table across all devices.
 * Uses a unique channel name to prevent multi-tab/multi-device collision.
 * Returns an unsubscribe callback for cleanup.
 */
export function subscribeToBookings(callback: () => void): () => void {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  const channelId = `realtime_bookings_${Math.random().toString(36).substring(2, 9)}`;
  const channel = supabase
    .channel(channelId)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
      },
      (payload) => {
        console.log('[Supabase Realtime event across devices]:', payload.eventType);
        callback();
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Supabase Realtime] Connected and listening for cross-device live sync.');
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
