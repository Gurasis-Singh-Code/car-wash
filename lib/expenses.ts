import { supabase, isSupabaseConfigured } from './supabase';
import { Expense, ExpenseRecurrence, ExpenseType } from '@/types/expense';
import { ServiceLocation } from '@/types/booking';

export interface ExpenseInput {
  category: string;
  type: ExpenseType;
  amount: number;
  /** First occurrence for a recurring expense; the only one otherwise. */
  date: string;
  recurrence: ExpenseRecurrence;
  /** Empty or null means it keeps repeating. Ignored when recurrence is 'none'. */
  recurrence_end?: string | null;
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
    // Rows created before recurrence existed have the column default.
    recurrence: row.recurrence || 'none',
    recurrence_end: row.recurrence_end || undefined,
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

  const recurrence = data.recurrence || 'none';
  // An end date only means anything for something that repeats. Clearing it
  // alongside the recurrence stops a stale bound being left on a one-off, where
  // the database CHECK would then reject an otherwise valid edit.
  const recurrenceEnd = recurrence === 'none' ? null : data.recurrence_end || null;

  if (recurrenceEnd && recurrenceEnd < data.date) {
    throw new Error('The repeat end date cannot be before the first date.');
  }

  return {
    category,
    type: data.type,
    amount,
    date: data.date,
    recurrence,
    recurrence_end: recurrenceEnd,
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
