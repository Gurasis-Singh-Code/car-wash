import { supabase, isSupabaseConfigured } from './supabase';
import { Detailer, DetailerStatus } from '@/types/detailer';

function decodeDetailerFromDb(row: any): Detailer {
  return {
    id: row.id,
    name: row.name,
    status: row.status || 'active',
    created_at: row.created_at,
    auth_user_id: row.auth_user_id ?? null,
    email: row.email ?? null,
  };
}

/** Every detailer, active first, then alphabetical. */
export async function getDetailers(): Promise<Detailer[]> {
  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] Credentials not configured. Returning empty detailers.');
    return [];
  }

  const { data, error } = await supabase
    .from('detailers')
    .select('*')
    .order('status', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('[Supabase getDetailers error]:', error.message);
    throw new Error(error.message);
  }

  return (data || []).map(decodeDetailerFromDb);
}

/** Create a detailer. Name is the only thing required. */
export async function addDetailer(name: string): Promise<Detailer> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set your credentials in .env.local');
  }

  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Detailer name is required.');
  }

  const { data, error } = await supabase
    .from('detailers')
    .insert([{ name: trimmed }])
    .select()
    .single();

  if (error) {
    console.error('[Supabase addDetailer error]:', error.message);
    // A unique index on lower(trim(name)) guards against duplicates.
    if (error.code === '23505') {
      throw new Error(`A detailer named "${trimmed}" already exists.`);
    }
    throw new Error(error.message);
  }

  return decodeDetailerFromDb(data);
}

/**
 * Flip a detailer between active and inactive. Inactive detailers drop out of
 * the assignment dropdown but keep every booking already assigned to them.
 */
export async function updateDetailerStatus(
  id: string,
  status: DetailerStatus
): Promise<Detailer> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set your credentials in .env.local');
  }

  const { data, error } = await supabase
    .from('detailers')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Supabase updateDetailerStatus error]:', error.message);
    throw new Error(error.message);
  }

  return decodeDetailerFromDb(data);
}

/**
 * Delete a detailer. The FK is ON DELETE SET NULL, so their bookings survive and
 * simply return to the unassigned queue rather than disappearing.
 */
export async function deleteDetailer(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set your credentials in .env.local');
  }

  const { error } = await supabase.from('detailers').delete().eq('id', id);

  if (error) {
    console.error('[Supabase deleteDetailer error]:', error.message);
    throw new Error(error.message);
  }
}

/**
 * Point a detailer at the Supabase Auth account that signs into the detailer
 * portal as them.
 *
 * The account itself is created in the Supabase dashboard, because that is the
 * only place a password can be set without it passing through this app. This
 * only does the lookup and the link, through an admin-guarded function, since
 * auth.users is not readable with the anon key.
 */
export async function linkDetailerLogin(id: string, email: string): Promise<Detailer> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set your credentials in .env.local');
  }

  const { data, error } = await supabase.rpc('admin_link_detailer_login', {
    p_detailer_id: id,
    p_email: email.trim(),
  });

  if (error) {
    console.error('[Supabase linkDetailerLogin error]:', error.message);
    throw new Error(error.message);
  }

  return decodeDetailerFromDb(data);
}

/** Revoke portal access without touching the roster entry or their bookings. */
export async function unlinkDetailerLogin(id: string): Promise<Detailer> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set your credentials in .env.local');
  }

  const { data, error } = await supabase.rpc('admin_unlink_detailer_login', {
    p_detailer_id: id,
  });

  if (error) {
    console.error('[Supabase unlinkDetailerLogin error]:', error.message);
    throw new Error(error.message);
  }

  return decodeDetailerFromDb(data);
}

/** Realtime subscription, mirroring the bookings and leads channels. */
export function subscribeToDetailers(callback: () => void): () => void {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  const channelId = `realtime_detailers_${Math.random().toString(36).substring(2, 9)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'detailers' }, () => {
      callback();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
