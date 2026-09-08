'use client';

import React, { useState } from 'react';
import {
  Expense,
  ExpenseType,
  EXPENSE_TYPE_LABELS,
  EXPENSE_TYPE_STYLES,
  formatMoney,
} from '@/types/expense';
import { ServiceLocation, SERVICE_LOCATION_LABELS } from '@/types/booking';
import { ExpenseInput } from '@/lib/expenses';
import ConfirmModal from './ConfirmModal';
import {
  Receipt,
  PlusCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Edit2,
  X,
  Tag,
  Calendar,
  Truck,
  Store,
} from 'lucide-react';

interface ExpenseManagerProps {
  expenses: Expense[];
  categories: string[];
  onAdd: (data: ExpenseInput) => Promise<void>;
  onUpdate: (id: string, data: ExpenseInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const EMPTY: ExpenseInput = {
  category: '',
  type: 'variable',
  amount: 0,
  date: new Date().toISOString().split('T')[0],
  service_location: null,
  notes: '',
};

/**
 * Manual expense entry. Nothing here is ever auto-generated — every row is
 * something the admin typed. Category is free text so new ones can be invented
 * on the spot; the datalist only suggests what has been used before.
 */
export default function ExpenseManager({
  expenses,
  categories,
  onAdd,
  onUpdate,
  onDelete,
}: ExpenseManagerProps) {
  const [form, setForm] = useState<ExpenseInput>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const resetForm = () => {
    setForm({ ...EMPTY, date: new Date().toISOString().split('T')[0] });
    setAmountText('');
    setEditingId(null);
    setError(null);
  };

  const startEdit = (e: Expense) => {
    setEditingId(e.id);
    setForm({
      category: e.category,
      type: e.type,
      amount: e.amount,
      date: e.date,
      service_location: e.service_location || null,
      notes: e.notes || '',
    });
    setAmountText(String(e.amount));
    setError(null);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);

    if (!form.category.trim()) {
      setError('Category is required');
      return;
    }
    const amount = parseFloat(amountText);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Enter a valid amount');
      return;
    }
    if (!form.date) {
      setError('Date is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = { ...form, amount };
      if (editingId) {
        await onUpdate(editingId, payload);
      } else {
        await onAdd(payload);
      }
      resetForm();
    } catch (err: any) {
      setError(err?.message || 'Failed to save expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    try {
      await onDelete(target.id);
      if (editingId === target.id) resetForm();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete expense.');
    }
  };

  const scopeOf = (e: Expense) => e.service_location || 'shared';

  return (
    <div className="bg-charcoal-card rounded-2xl p-4 sm:p-5 border border-charcoal-border/60 shadow-soft-sm space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-charcoal-border/40">
        <div className="w-8 h-8 rounded-xl bg-sage-100 text-sage-800 flex items-center justify-center shrink-0">
          <Receipt className="w-4 h-4 text-sage-700" />
        </div>
        <div>
          <h2 className="text-sm sm:text-base font-bold text-charcoal tracking-tight">Expenses</h2>
          <p className="text-[11px] sm:text-xs text-charcoal-muted">
            Every entry is manual. Invent categories as you need them.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Category — free text with suggestions from what already exists */}
          <div>
            <label
              htmlFor="expense_category"
              className="block text-xs font-semibold uppercase tracking-wider text-charcoal mb-1.5"
            >
              Category <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-muted">
                <Tag className="w-4 h-4 text-sage-600" />
              </div>
              <input
                id="expense_category"
                list="expense_categories"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Supplies, Fuel, Insurance"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-base sm:text-sm bg-canvas border border-charcoal-border text-charcoal placeholder:text-charcoal-light/70 focus:border-sage-500 focus:bg-charcoal-card transition-colors"
              />
              <datalist id="expense_categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label
              htmlFor="expense_amount"
              className="block text-xs font-semibold uppercase tracking-wider text-charcoal mb-1.5"
            >
              Amount <span className="text-red-500">*</span>
            </label>
            <input
              id="expense_amount"
              type="number"
              min="0"
              step="0.01"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="0.00"
              className="w-full px-3.5 py-2.5 rounded-xl text-base sm:text-sm bg-canvas border border-charcoal-border text-charcoal placeholder:text-charcoal-light/70 focus:border-sage-500 focus:bg-charcoal-card transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Fixed / variable */}
          <div>
            <label
              htmlFor="expense_type"
              className="block text-xs font-semibold uppercase tracking-wider text-charcoal mb-1.5"
            >
              Type <span className="text-red-500">*</span>
            </label>
            <select
              id="expense_type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as ExpenseType })}
              className="w-full px-3.5 py-2.5 rounded-xl text-base sm:text-sm bg-canvas border border-charcoal-border text-charcoal focus:border-sage-500 focus:bg-charcoal-card transition-colors cursor-pointer"
            >
              <option value="variable">{EXPENSE_TYPE_LABELS.variable}</option>
              <option value="fixed">{EXPENSE_TYPE_LABELS.fixed}</option>
            </select>
          </div>

          {/* Attribution. Blank means shared overhead, never split automatically. */}
          <div>
            <label
              htmlFor="expense_location"
              className="block text-xs font-semibold uppercase tracking-wider text-charcoal mb-1.5"
            >
              Applies To
            </label>
            <select
              id="expense_location"
              value={form.service_location || ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  service_location: (e.target.value || null) as ServiceLocation | null,
                })
              }
              className="w-full px-3.5 py-2.5 rounded-xl text-base sm:text-sm bg-canvas border border-charcoal-border text-charcoal focus:border-sage-500 focus:bg-charcoal-card transition-colors cursor-pointer"
            >
              <option value="">Shared (both)</option>
              <option value="mobile">{SERVICE_LOCATION_LABELS.mobile}</option>
              <option value="shop">{SERVICE_LOCATION_LABELS.shop}</option>
            </select>
          </div>

          {/* Date */}
          <div>
            <label
              htmlFor="expense_date"
              className="block text-xs font-semibold uppercase tracking-wider text-charcoal mb-1.5"
            >
              Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-muted">
                <Calendar className="w-4 h-4 text-sage-600" />
              </div>
              <input
                id="expense_date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-base sm:text-sm bg-canvas border border-charcoal-border text-charcoal focus:border-sage-500 focus:bg-charcoal-card transition-colors"
              />
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="expense_notes"
            className="block text-xs font-semibold uppercase tracking-wider text-charcoal mb-1.5"
          >
            Notes
          </label>
          <input
            id="expense_notes"
            type="text"
            value={form.notes || ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional"
            className="w-full px-3.5 py-2.5 rounded-xl text-base sm:text-sm bg-canvas border border-charcoal-border text-charcoal placeholder:text-charcoal-light/70 focus:border-sage-500 focus:bg-charcoal-card transition-colors"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" /> {error}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5">
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-3.5 sm:py-2 text-xs sm:text-sm font-medium text-charcoal-muted hover:text-charcoal bg-sage-50/80 hover:bg-sage-100 rounded-xl transition-colors text-center"
            >
              Cancel Edit
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-3.5 sm:py-2.5 bg-sage-500 hover:bg-sage-600 active:scale-[0.99] text-white dark:text-charcoal-card text-xs sm:text-sm font-semibold rounded-xl shadow-soft-sm transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : editingId ? (
              <Edit2 className="w-4 h-4" />
            ) : (
              <PlusCircle className="w-4 h-4" />
            )}
            <span>{editingId ? 'Save Changes' : 'Add Expense'}</span>
          </button>
        </div>
      </form>

      {/* Recent entries */}
      <div className="pt-3 border-t border-charcoal-border/40 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
            Logged Expenses
          </h3>
          {expenses.length > 0 && (
            <span className="text-[11px] text-charcoal-muted">{expenses.length} total</span>
          )}
        </div>

        {expenses.length === 0 ? (
          <p className="text-xs text-charcoal-muted py-3 text-center">
            No expenses logged yet.
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {expenses.map((e) => {
              const scope = scopeOf(e);
              return (
                <div
                  key={e.id}
                  className={`flex flex-wrap items-center gap-2 p-2.5 rounded-xl border bg-canvas ${
                    editingId === e.id ? 'border-sage-400 ring-2 ring-sage-400/20' : 'border-charcoal-border/60'
                  }`}
                >
                  <span className="font-semibold text-sm text-charcoal">{formatMoney(e.amount)}</span>

                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sage-50 text-sage-800 border border-sage-200">
                    {e.category}
                  </span>

                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${EXPENSE_TYPE_STYLES[e.type]}`}
                  >
                    {EXPENSE_TYPE_LABELS[e.type]}
                  </span>

                  {scope !== 'shared' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-charcoal-surface text-charcoal-muted border border-charcoal-border/50">
                      {scope === 'mobile' ? <Truck className="w-3 h-3" /> : <Store className="w-3 h-3" />}
                      <span>{SERVICE_LOCATION_LABELS[scope as ServiceLocation]}</span>
                    </span>
                  )}

                  <span className="text-[11px] text-charcoal-muted">{e.date}</span>

                  {e.notes && (
                    <span className="text-[11px] text-charcoal-muted truncate max-w-[160px]" title={e.notes}>
                      {e.notes}
                    </span>
                  )}

                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      type="button"
                      onClick={() => startEdit(e)}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-sage-700 bg-sage-50 hover:bg-sage-100 rounded-lg border border-sage-200/70 transition-colors"
                      aria-label={`Edit ${e.category} expense`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(e)}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200/60 transition-colors"
                      aria-label={`Delete ${e.category} expense`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(deleting)}
        title="Delete Expense"
        message={
          deleting
            ? `Delete the ${formatMoney(deleting.amount)} ${deleting.category} expense from ${deleting.date}? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete Expense"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
