import { Expense } from '@/types/expense';

/**
 * Turning recurring expenses into the individual costs that actually landed in
 * a date range.
 *
 * Dates are handled as YYYY-MM-DD strings and compared as strings throughout.
 * That works because the format sorts lexicographically, and it avoids
 * `new Date("2026-09-09")`, which is parsed as UTC midnight and lands on the
 * previous day for anyone west of Greenwich. The Date object is used only for
 * arithmetic, built from local parts and read back from local getters.
 */

/** One instance of a cost on one day. A one-off expense yields exactly one. */
export interface ExpenseOccurrence {
  expense: Expense;
  /** The day this instance falls on, YYYY-MM-DD. */
  date: string;
  amount: number;
}

function toIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m, d];
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = parts(iso);
  return toIso(new Date(y, m - 1, d + n));
}

/**
 * Add months, clamping the day to the end of the target month.
 *
 * A cost first entered on the 31st recurs on the 30th in November and the 28th
 * in February, rather than rolling over into the following month - which is what
 * `new Date(y, m, 31)` would do, quietly turning February's entry into March's
 * and skipping a month entirely.
 */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = parts(iso);
  const target = new Date(y, m - 1 + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  return toIso(target);
}

export function todayIso(): string {
  return toIso(new Date());
}

/**
 * A hard ceiling on how many instances one record can generate. Weekly for ten
 * years is ~520, so this cannot be reached by real data; it exists so that a
 * corrupt start date cannot spin the browser.
 */
const MAX_OCCURRENCES = 1000;

/**
 * Expand expenses into the occurrences falling within [fromIso, toIso].
 *
 * Recurring costs never accrue past `toIso`, and callers pass today as the
 * upper bound, so profit is never charged for a cost that has not been incurred
 * yet. A one-off keeps whatever date it was given, including a future one — it
 * was entered deliberately, and that is how it behaved before recurrence
 * existed.
 */
export function expandExpenses(
  expenses: Expense[],
  fromIso: string,
  toIso: string
): ExpenseOccurrence[] {
  const out: ExpenseOccurrence[] = [];

  expenses.forEach((expense) => {
    if (expense.recurrence === 'none') {
      if (expense.date >= fromIso && expense.date <= toIso) {
        out.push({ expense, date: expense.date, amount: expense.amount });
      }
      return;
    }

    // Stop at whichever comes first: the end of the window, or the day the
    // expense was set to stop repeating.
    const stop =
      expense.recurrence_end && expense.recurrence_end < toIso ? expense.recurrence_end : toIso;

    // `step` counts occurrences from the first one. Monthly dates are always
    // measured as (original date + N months) rather than by stepping from the
    // previous occurrence, so that clamping in a short month is not permanent:
    // a cost starting on the 31st recurs on Feb 28 and then Mar 31, not Feb 28
    // and then Mar 28.
    for (let step = 0; step < MAX_OCCURRENCES; step += 1) {
      const cursor =
        expense.recurrence === 'weekly'
          ? addDays(expense.date, step * 7)
          : addMonths(expense.date, step);

      if (cursor > stop) break;
      if (cursor >= fromIso) {
        out.push({ expense, date: cursor, amount: expense.amount });
      }
    }
  });

  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Total of a set of occurrences. */
export function sumOccurrences(occurrences: ExpenseOccurrence[]): number {
  return occurrences.reduce((sum, o) => sum + o.amount, 0);
}
