import { supabase, isSupabaseConfigured } from './supabase';
import { Lead, LeadStatus } from '@/types/lead';

/**
 * Decodes a raw lead row from Supabase into the application's Lead type.
 * Every field lives in its own dedicated column, so this is a straight map
 * with null -> undefined normalisation and sane defaults for the counters.
 */
function decodeLeadFromDb(row: any): Lead {
  return {
    id: row.id,
    instagram_user_id: row.instagram_user_id,
    instagram_username: row.instagram_username || undefined,
    customer_name: row.customer_name || undefined,
    client_no: row.client_no || undefined,
    email: row.email || undefined,
    car_type: row.car_type || undefined,
    car_count: row.car_count ?? undefined,
    vehicle_make_model: row.vehicle_make_model || undefined,
    service: row.service || undefined,
    pet_hair: Boolean(row.pet_hair),
    address: row.address || undefined,
    booking_date: row.booking_date || undefined,
    booking_time: row.booking_time || undefined,
    has_power: row.has_power ?? undefined,
    has_water: row.has_water ?? undefined,
    price: row.price !== null && row.price !== undefined ? Number(row.price) : undefined,
    notes: row.notes || undefined,
    last_message: row.last_message || undefined,
    message_count: Number(row.message_count || 0),
    lead_status: row.lead_status || 'new',
    booking_id: row.booking_id || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_message_at: row.last_message_at,
  };
}

/**
 * Fetch all leads, most recently active conversations first.
 */
export async function getLeads(): Promise<Lead[]> {
  if (!isSupabaseConfigured()) {
    console.warn(
      '[Supabase] Credentials not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'
    );
    return [];
  }

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('last_message_at', { ascending: false });

  if (error) {
    console.error('[Supabase getLeads error]:', error.message);
    throw new Error(error.message);
  }

  return (data || []).map(decodeLeadFromDb);
}

/**
 * Update the pipeline status of a single lead.
 */
export async function updateLeadStatus(id: string, status: LeadStatus): Promise<Lead> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set your credentials in .env.local');
  }

  const { data, error } = await supabase
    .from('leads')
    .update({ lead_status: status })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Supabase updateLeadStatus error]:', error.message);
    throw new Error(error.message);
  }

  return decodeLeadFromDb(data);
}

/**
 * Delete a lead row by ID.
 */
export async function deleteLead(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set your credentials in .env.local');
  }

  const { error } = await supabase.from('leads').delete().eq('id', id);

  if (error) {
    console.error('[Supabase deleteLead error]:', error.message);
    throw new Error(error.message);
  }
}

/**
 * Subscribe to realtime changes on the leads table across all devices.
 * Uses a unique channel name to prevent multi-tab/multi-device collision.
 * Returns an unsubscribe callback for cleanup.
 */
export function subscribeToLeads(callback: () => void): () => void {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  const channelId = `realtime_leads_${Math.random().toString(36).substring(2, 9)}`;
  const channel = supabase
    .channel(channelId)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'leads',
      },
      (payload) => {
        console.log('[Supabase Realtime lead event]:', payload.eventType);
        callback();
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Supabase Realtime] Connected and listening for live lead updates.');
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
