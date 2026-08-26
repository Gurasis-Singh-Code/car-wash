import { supabase, isSupabaseConfigured } from './supabase';
import { Booking, BookingStats, ServiceType } from '@/types/booking';

interface LocalBookingMeta {
  client_no?: string;
  car_count?: number;
  assigned_detailer?: string;
}

const META_STORAGE_KEY = 'car_wash_bookings_meta_v1';

function getLocalMetaMap(): Record<string, LocalBookingMeta> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('[localStorage read error]:', e);
    return {};
  }
}

function saveLocalMeta(id: string, meta: LocalBookingMeta) {
  if (typeof window === 'undefined' || !id) return;
  try {
    const all = getLocalMetaMap();
    all[id] = {
      ...(all[id] || {}),
      ...(meta.client_no !== undefined ? { client_no: meta.client_no } : {}),
      ...(meta.car_count !== undefined ? { car_count: meta.car_count } : {}),
      ...(meta.assigned_detailer !== undefined ? { assigned_detailer: meta.assigned_detailer } : {}),
    };
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('[localStorage write error]:', e);
  }
}

function removeLocalMeta(id: string) {
  if (typeof window === 'undefined' || !id) return;
  try {
    const all = getLocalMetaMap();
    delete all[id];
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('[localStorage remove error]:', e);
  }
}

function attachLocalMeta(booking: Booking): Booking {
  const localMap = getLocalMetaMap();
  const meta = localMap[booking.id];

  // If Supabase already returned the field from database, sync it into local cache
  if (booking.client_no || booking.car_count || booking.assigned_detailer) {
    saveLocalMeta(booking.id, {
      client_no: booking.client_no,
      car_count: booking.car_count,
      assigned_detailer: booking.assigned_detailer,
    });
  }

  if (!meta) return booking;

  return {
    ...booking,
    client_no: booking.client_no || meta.client_no || undefined,
    car_count: booking.car_count ?? meta.car_count ?? 1,
    assigned_detailer:
      booking.assigned_detailer && booking.assigned_detailer !== 'Unassigned'
        ? booking.assigned_detailer
        : (meta.assigned_detailer || booking.assigned_detailer || 'Unassigned'),
  };
}

/**
 * Fetch all bookings from Supabase, ordered by booking date and time.
 */
export async function getBookings(): Promise<Booking[]> {
  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] Credentials not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.');
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

  const rows = (data as Booking[]) || [];
  return rows.map(attachLocalMeta);
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

  const rows = (data as Booking[]) || [];
  return rows.map(attachLocalMeta);
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
    // Return zeros if view query fails (e.g. empty or initializing)
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

function isSchemaMismatchError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === 'PGRST204' ||
    msg.includes('schema cache') ||
    msg.includes('column') ||
    msg.includes('could not find the')
  );
}

/**
 * Add a new booking row to the bookings table.
 */
export async function addBooking(
  data: Omit<Booking, 'id' | 'status'>
): Promise<Booking> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set your credentials in .env.local');
  }

  const clientNo = data.client_no?.trim() || null;
  const carCount = Number(data.car_count) || 1;
  const assignedDetailer = data.assigned_detailer?.trim() || 'Unassigned';

  const payload: any = {
    ...data,
    client_no: clientNo,
    car_count: carCount,
    assigned_detailer: assignedDetailer,
    service: normalizeService(data.service) || 'interior_silver',
    status: 'scheduled',
  };

  let createdRecord: Booking | null = null;

  let { data: created, error } = await supabase
    .from('bookings')
    .insert([payload])
    .select()
    .single();

  // If columns are missing in Supabase schema cache yet, retry with base columns
  if (error && isSchemaMismatchError(error)) {
    console.warn(
      '[Supabase schema warning]: Extra columns missing from Supabase table. Inserting base fields and persisting metadata locally. Please run the ALTER TABLE script in Supabase SQL editor.'
    );
    const { client_no: _c, car_count: _cc, assigned_detailer: _ad, ...basePayload } = payload;
    const retry = await supabase
      .from('bookings')
      .insert([basePayload])
      .select()
      .single();

    if (retry.error) {
      throw new Error(retry.error.message);
    }
    createdRecord = {
      ...retry.data,
      client_no: clientNo || undefined,
      car_count: carCount,
      assigned_detailer: assignedDetailer,
    } as Booking;
  } else if (error) {
    console.error('[Supabase addBooking error]:', error.message);
    throw new Error(error.message);
  } else {
    createdRecord = created as Booking;
  }

  // Persist metadata locally so it survives any refresh even without DB columns
  if (createdRecord?.id) {
    saveLocalMeta(createdRecord.id, {
      client_no: clientNo || undefined,
      car_count: carCount,
      assigned_detailer: assignedDetailer,
    });
  }

  return attachLocalMeta(createdRecord as Booking);
}

/**
 * Update an existing booking row.
 */
export async function updateBooking(
  id: string,
  data: Partial<Booking>
): Promise<Booking> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set your credentials in .env.local');
  }

  const clientNo = data.client_no !== undefined ? (data.client_no?.trim() || null) : undefined;
  const carCount = data.car_count !== undefined ? (Number(data.car_count) || 1) : undefined;
  const assignedDetailer = data.assigned_detailer !== undefined ? (data.assigned_detailer?.trim() || 'Unassigned') : undefined;

  // Persist metadata locally
  saveLocalMeta(id, {
    ...(clientNo !== undefined ? { client_no: clientNo || undefined } : {}),
    ...(carCount !== undefined ? { car_count: carCount } : {}),
    ...(assignedDetailer !== undefined ? { assigned_detailer: assignedDetailer } : {}),
  });

  const updatePayload: any = {
    ...data,
    ...(data.service ? { service: normalizeService(data.service) } : {}),
    ...(clientNo !== undefined ? { client_no: clientNo } : {}),
    ...(carCount !== undefined ? { car_count: carCount } : {}),
    ...(assignedDetailer !== undefined ? { assigned_detailer: assignedDetailer } : {}),
  };

  let updatedRecord: Booking | null = null;

  let { data: updated, error } = await supabase
    .from('bookings')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  // If column doesn't exist in Supabase table schema cache yet, retry with base columns
  if (error && isSchemaMismatchError(error)) {
    console.warn(
      '[Supabase schema warning]: Extra columns missing from Supabase table. Updating basic fields and persisting metadata locally.'
    );
    const { client_no: _c, car_count: _cc, assigned_detailer: _ad, ...basePayload } = updatePayload;
    const retry = await supabase
      .from('bookings')
      .update(basePayload)
      .eq('id', id)
      .select()
      .single();

    if (retry.error) {
      throw new Error(retry.error.message);
    }
    updatedRecord = {
      ...retry.data,
      ...(clientNo !== undefined ? { client_no: clientNo || undefined } : {}),
      ...(carCount !== undefined ? { car_count: carCount } : {}),
      ...(assignedDetailer !== undefined ? { assigned_detailer: assignedDetailer } : {}),
    } as Booking;
  } else if (error) {
    console.error('[Supabase updateBooking error]:', error.message);
    throw new Error(error.message);
  } else {
    updatedRecord = updated as Booking;
  }

  return attachLocalMeta(updatedRecord as Booking);
}

/**
 * Delete a booking row by ID.
 */
export async function deleteBooking(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set your credentials in .env.local');
  }

  removeLocalMeta(id);

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
 * Subscribe to realtime changes on the bookings table.
 * Returns an unsubscribe callback for cleanup.
 */
export function subscribeToBookings(callback: () => void): () => void {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  const channel = supabase
    .channel('bookings_realtime_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
      },
      (payload) => {
        console.log('[Supabase Realtime event received]:', payload.eventType);
        callback();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
