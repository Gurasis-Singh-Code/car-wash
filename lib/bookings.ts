import { supabase, isSupabaseConfigured } from './supabase';
import { Booking, BookingStats, ServiceType } from '@/types/booking';

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

  return (data as Booking[]) || [];
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

  return (data as Booking[]) || [];
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

/**
 * Add a new booking row to the bookings table.
 */
export async function addBooking(
  data: Omit<Booking, 'id' | 'status'>
): Promise<Booking> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set your credentials in .env.local');
  }

  const { data: created, error } = await supabase
    .from('bookings')
    .insert([
      {
        ...data,
        service: normalizeService(data.service) || 'interior_silver',
        status: 'scheduled',
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('[Supabase addBooking error]:', error.message);
    throw new Error(error.message);
  }

  return created as Booking;
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

  const updatePayload = {
    ...data,
    ...(data.service ? { service: normalizeService(data.service) } : {}),
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

  return updated as Booking;
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
