import { supabase, isSupabaseConfigured } from './supabase';
import { Expense, ExpenseType } from '@/types/expense';
import { ServiceLocation } from '@/types/booking';

export interface ExpenseInput {
  category: string;
  type: ExpenseType;
  amount: number;
  date: string;
  /** Omit or pass null for shared overhead. */
  service_location?: ServiceLocation | null;
  notes?: string;
}

function decodeExpenseFromDb(row: any): Expense {
  return {
    id: row.id,
    category: row.category,
    type: row.type || 'variable',
    amount: Number(row.amount || 0),
    date: row.date,
    service_location: row.service_location || undefined,
    notes: row.notes || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Every expense, newest first. */
export async function getExpenses(): Promise<Expense[]> {
  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] Credentials not configured. Returning empty expenses.');
    return [];
  }

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase getExpenses error]:', error.message);
    throw new Error(error.message);
  }

  return (data || []).map(decodeExpenseFromDb);
}

function toPayload(data: ExpenseInput) {
  const category = data.category.trim();
  if (!category) throw new Error('Category is required.');

  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Amount must be a positive number.');
  }

  return {
    category,
    type: data.type,
    amount,
    date: data.date,
    // Empty string from a <select> means shared, which is stored as null.
    service_location: data.service_location || null,
    notes: data.notes?.trim() || null,
  };
}

export async function addExpense(data: ExpenseInput): Promise<Expense> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set your credentials in .env.local');
  }

  const { data: created, error } = await supabase
    .from('expenses')
    .insert([toPayload(data)])
    .select()
    .single();

  if (error) {
    console.error('[Supabase addExpense error]:', error.message);
    throw new Error(error.message);
  }

  return decodeExpenseFromDb(created);
}

export async function updateExpense(id: string, data: ExpenseInput): Promise<Expense> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set your credentials in .env.local');
  }

  const { data: updated, error } = await supabase
    .from('expenses')
    .update(toPayload(data))
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Supabase updateExpense error]:', error.message);
    throw new Error(error.message);
  }

  return decodeExpenseFromDb(updated);
}

export async function deleteExpense(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set your credentials in .env.local');
  }

  const { error } = await supabase.from('expenses').delete().eq('id', id);

  if (error) {
    console.error('[Supabase deleteExpense error]:', error.message);
    throw new Error(error.message);
  }
}

/** Distinct categories already used, for the datalist on the expense form. */
export function existingCategories(expenses: Expense[]): string[] {
  const seen = new Map<string, string>();
  expenses.forEach((e) => {
    const key = e.category.trim().toLowerCase();
    if (key && !seen.has(key)) seen.set(key, e.category.trim());
  });
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

export function subscribeToExpenses(callback: () => void): () => void {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  const channelId = `realtime_expenses_${Math.random().toString(36).substring(2, 9)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
      callback();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
