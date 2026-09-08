import { ServiceLocation } from './booking';

export type ExpenseType = 'fixed' | 'variable';

export interface Expense {
  id: string;
  category: string;
  type: ExpenseType;
  amount: number;
  date: string;
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
