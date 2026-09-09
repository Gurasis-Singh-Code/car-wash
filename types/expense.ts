import { ServiceLocation } from './booking';

export type ExpenseType = 'fixed' | 'variable';

/**
 * How often the cost repeats. 'none' is a single entry on its own date; the
 * others repeat from `date` onwards until `recurrence_end`, or forever.
 *
 * No occurrence rows are stored. One record is expanded as the finance figures
 * are calculated, so correcting the amount corrects every occurrence at once
 * and nothing has to run on a schedule for the numbers to be right.
 */
export type ExpenseRecurrence = 'none' | 'weekly' | 'monthly';

export interface Expense {
  id: string;
  category: string;
  type: ExpenseType;
  amount: number;
  /** For a recurring expense this is the FIRST occurrence, not the only one. */
  date: string;
  recurrence: ExpenseRecurrence;
  /** Last day it may repeat. undefined means it is still running. */
  recurrence_end?: string;
  /** undefined means shared overhead belonging to neither channel. */
  service_location?: ServiceLocation;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  fixed: 'Fixed',
  variable: 'Variable',
};

/** Pill styling for the fixed / variable tag. */
export const EXPENSE_TYPE_STYLES: Record<ExpenseType, string> = {
  fixed: 'bg-purple-50 text-purple-700 border-purple-200/60',
  variable: 'bg-amber-50 text-amber-800 border-amber-200/70',
};

export const EXPENSE_RECURRENCE_LABELS: Record<ExpenseRecurrence, string> = {
  none: 'One-off',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

/** Pill styling for the repeat tag. Only shown when it actually repeats. */
export const EXPENSE_RECURRENCE_STYLES: Record<ExpenseRecurrence, string> = {
  none: 'bg-charcoal-surface text-charcoal-muted border-charcoal-border/50',
  weekly: 'bg-blue-50 text-blue-700 border-blue-200/70',
  monthly: 'bg-blue-50 text-blue-700 border-blue-200/70',
};

/** How an expense is attributed. Shared costs are never split across locations. */
export const EXPENSE_SCOPE_LABELS: Record<string, string> = {
  mobile: 'Mobile',
  shop: 'Shop',
  shared: 'Shared',
};

/** Money formatting used across the finance views. */
export function formatMoney(value: number): string {
  return value.toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
