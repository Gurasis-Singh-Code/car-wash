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

/**
 * Encodes metadata into address string if native database columns are missing.
 * This guarantees live sync across different devices via Supabase.
 */
function encodeAddressWithMeta(
  rawAddress: string,
  meta: { client_no?: string | null; car_count?: number; assigned_detailer?: string | null }
): string {
  const clean = (rawAddress || '').replace(/\n?<!--meta:[\s\S]*?-->/, '').trim();
  const metaObj: Record<string, any> = {};
  if (meta.client_no) metaObj.client_no = meta.client_no.trim();
  if (meta.car_count && meta.car_count > 1) metaObj.car_count = meta.car_count;
  if (meta.assigned_detailer && meta.assigned_detailer !== 'Unassigned') {
    metaObj.assigned_detailer = meta.assigned_detailer.trim();
  }

  if (Object.keys(metaObj).length === 0) {
    return clean;
  }

  return `${clean}\n<!--meta:${JSON.stringify(metaObj)}-->`;
}

/**
 * Decodes a raw booking row from Supabase, extracting any embedded cross-device metadata.
 */
function decodeBookingFromDb(row: any): Booking {
  let address = row.address || '';
  let meta: LocalBookingMeta = {};

  const match = address.match(/\n?<!--meta:([\s\S]*?)-->/);
  if (match) {
    try {
      meta = JSON.parse(match[1]);
      address = address.replace(/\n?<!--meta:[\s\S]*?-->/, '').trim();
    } catch (e) {
      console.warn('[decodeBookingFromDb metadata parse error]:', e);
    }
  }

  const localMap = getLocalMetaMap();
  const localCache = localMap[row.id] || {};

  const client_no = row.client_no || meta.client_no || localCache.client_no || undefined;
  const car_count = row.car_count ?? meta.car_count ?? localCache.car_count ?? 1;
  const assigned_detailer =
    row.assigned_detailer && row.assigned_detailer !== 'Unassigned'
      ? row.assigned_detailer
      : (meta.assigned_detailer || localCache.assigned_detailer || row.assigned_detailer || 'Unassigned');

  // Cache decoded metadata locally
  if (client_no || car_count > 1 || (assigned_detailer && assigned_detailer !== 'Unassigned')) {
    saveLocalMeta(row.id, {
      client_no,
      car_count,
      assigned_detailer,
    });
  }

  return {
    id: row.id,
    customer_name: row.customer_name,
    client_no,
    car_count,
    assigned_detailer,
    service: row.service,
    address,
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
 * Encodes cross-device metadata automatically if native columns are missing.
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

  let createdRecord: any = null;

  // First try inserting with native columns
  let { data: created, error } = await supabase
    .from('bookings')
    .insert([payload])
    .select()
    .single();

  // If columns are missing in Supabase schema, embed cross-device metadata in address
  if (error && isSchemaMismatchError(error)) {
    console.warn(
      '[Supabase sync]: Native columns missing in table. Embedding cross-device metadata in row for live sync.'
    );
    const { client_no: _c, car_count: _cc, assigned_detailer: _ad, address: rawAddr, ...basePayload } = payload;
    const addressWithMeta = encodeAddressWithMeta(rawAddr, {
      client_no: clientNo,
      car_count: carCount,
      assigned_detailer: assignedDetailer,
    });

    const retry = await supabase
      .from('bookings')
      .insert([{ ...basePayload, address: addressWithMeta }])
      .select()
      .single();

    if (retry.error) {
      throw new Error(retry.error.message);
    }
    createdRecord = retry.data;
  } else if (error) {
    console.error('[Supabase addBooking error]:', error.message);
    throw new Error(error.message);
  } else {
    createdRecord = created;
  }

  return decodeBookingFromDb(createdRecord);
}

/**
 * Update an existing booking row.
 * Encodes cross-device metadata automatically if native columns are missing.
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

  const updatePayload: any = {
    ...data,
    ...(data.service ? { service: normalizeService(data.service) } : {}),
    ...(clientNo !== undefined ? { client_no: clientNo } : {}),
    ...(carCount !== undefined ? { car_count: carCount } : {}),
    ...(assignedDetailer !== undefined ? { assigned_detailer: assignedDetailer } : {}),
  };

  let updatedRecord: any = null;

  // First try updating with native columns
  let { data: updated, error } = await supabase
    .from('bookings')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  // If column doesn't exist in Supabase table schema, embed metadata in address
  if (error && isSchemaMismatchError(error)) {
    console.warn(
      '[Supabase sync]: Native columns missing in table. Embedding cross-device metadata in update for live sync.'
    );
    const { client_no: _c, car_count: _cc, assigned_detailer: _ad, address: rawAddr, ...basePayload } = updatePayload;
    
    // If address was not provided in this update, fetch current address first
    let currentAddress = rawAddr;
    if (!currentAddress) {
      const { data: currentDoc } = await supabase.from('bookings').select('address').eq('id', id).single();
      currentAddress = currentDoc?.address || '';
    }

    const addressWithMeta = encodeAddressWithMeta(currentAddress, {
      client_no: clientNo,
      car_count: carCount,
      assigned_detailer: assignedDetailer,
    });

    const retry = await supabase
      .from('bookings')
      .update({ ...basePayload, address: addressWithMeta })
      .eq('id', id)
      .select()
      .single();

    if (retry.error) {
      throw new Error(retry.error.message);
    }
    updatedRecord = retry.data;
  } else if (error) {
    console.error('[Supabase updateBooking error]:', error.message);
    throw new Error(error.message);
  } else {
    updatedRecord = updated;
  }

  return decodeBookingFromDb(updatedRecord);
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
