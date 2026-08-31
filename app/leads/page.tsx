'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Lead,
  LeadStatus,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_ORDER,
  LEAD_STATUS_STYLES,
} from '@/types/lead';
import { SERVICE_LABELS, CAR_TYPE_LABELS } from '@/types/booking';
import { getLeads, updateLeadStatus, deleteLead, subscribeToLeads } from '@/lib/leads';
import { resolveInstagram } from '@/lib/instagram';
import { useAuth } from '@/components/AuthProvider';
import ConfirmModal from '@/components/ConfirmModal';
import {
  Sparkles,
  RefreshCw,
  AlertCircle,
  Instagram,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Car,
  MessageSquare,
  Search,
  X,
  Trash2,
  Inbox,
  TrendingUp,
  Users,
  CheckCircle2,
  Loader2,
  DollarSign,
  StickyNote,
  PawPrint,
  Zap,
  Droplet,
  ExternalLink,
} from 'lucide-react';

/**
 * Human-friendly relative time, e.g. "5m ago", "3h ago", "2d ago".
 */
function formatRelativeTime(iso?: string): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';

  const diffMs = Date.now() - then;
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (y && m && d) {
      return new Date(y, m - 1, d).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  } catch {
    // fall through
  }
  return dateStr;
}

function formatDisplayTime(timeStr?: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    if (!Number.isNaN(hours)) {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      return `${hours % 12 || 12}:${parts[1]} ${ampm}`;
    }
  }
  return timeStr;
}

/** Best available display name for a lead that may only have an Instagram ID. */
function leadDisplayName(lead: Lead): string {
  const handle = resolveInstagram(lead.instagram_user_id, lead.instagram_username)?.handle;
  return lead.customer_name || (handle ? `@${handle}` : '') || 'Unidentified Lead';
}


export default function LeadsPage() {
  const { isConfigured } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);

  const loadLeads = useCallback(async () => {
    try {
      setError(null);
      const data = await getLeads();
      setLeads(data);
    } catch (err: any) {
      console.error('[LeadsPage loadLeads error]:', err);
      setError(err?.message || 'Failed to load leads from Supabase.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();

    const unsubscribe = subscribeToLeads(() => {
      console.log('[LeadsPage Realtime] Lead change detected. Refreshing...');
      loadLeads();
    });

    return () => {
      unsubscribe();
    };
  }, [loadLeads]);

  // Counts per pipeline stage
  const statusCounts = useMemo(() => {
    const counts: Record<LeadStatus, number> = {
      new: 0,
      in_progress: 0,
      details_collected: 0,
      confirmed: 0,
      converted: 0,
      lost: 0,
    };
    leads.forEach((l) => {
      if (counts[l.lead_status] !== undefined) counts[l.lead_status] += 1;
    });
    return counts;
  }, [leads]);

  const metrics = useMemo(() => {
    const total = leads.length;
    const converted = statusCounts.converted;
    // Everything still moving through the funnel (not yet won or lost)
    const active =
      statusCounts.new +
      statusCounts.in_progress +
      statusCounts.details_collected +
      statusCounts.confirmed;

    return {
      total,
      active,
      converted,
      lost: statusCounts.lost,
      conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
    };
  }, [leads, statusCounts]);

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return leads.filter((lead) => {
      if (statusFilter !== 'all' && lead.lead_status !== statusFilter) return false;
      if (!q) return true;

      return Boolean(
        lead.customer_name?.toLowerCase().includes(q) ||
          lead.instagram_username?.toLowerCase().includes(q) ||
          lead.instagram_user_id?.toLowerCase().includes(q) ||
          lead.client_no?.toLowerCase().includes(q) ||
          lead.email?.toLowerCase().includes(q) ||
          lead.address?.toLowerCase().includes(q) ||
          lead.vehicle_make_model?.toLowerCase().includes(q) ||
          lead.notes?.toLowerCase().includes(q) ||
          lead.last_message?.toLowerCase().includes(q)
      );
    });
  }, [leads, statusFilter, searchQuery]);

  const handleStatusChange = async (lead: Lead, newStatus: LeadStatus) => {
    if (lead.lead_status === newStatus) return;

    const previousLeads = [...leads];
    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, lead_status: newStatus } : l))
    );

    try {
      setUpdatingId(lead.id);
      setError(null);
      await updateLeadStatus(lead.id, newStatus);
    } catch (err: any) {
      console.error('[handleStatusChange error]:', err);
      setLeads(previousLeads); // Rollback
      setError(err?.message || 'Failed to update lead status on Supabase.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingLead) return;

    const previousLeads = [...leads];
    const target = deletingLead;
    setDeletingLead(null);
    // Optimistic removal
    setLeads((prev) => prev.filter((l) => l.id !== target.id));

    try {
      setError(null);
      await deleteLead(target.id);
    } catch (err: any) {
      console.error('[handleConfirmDelete error]:', err);
      setLeads(previousLeads); // Rollback
      setError(err?.message || 'Failed to delete lead on Supabase.');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-2 border-b border-charcoal-border/40">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-charcoal">
              Leads &amp; Inbox Pipeline
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-sage-100 text-sage-800">
              <Sparkles className="w-3 h-3 text-sage-600" />
              Live Sync
            </span>
          </div>
          <p className="text-xs sm:text-sm text-charcoal-muted mt-0.5 sm:mt-1">
            Inbound Instagram enquiries captured by the automation, tracked from first message to booking.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={() => loadLeads()}
            className="p-2.5 rounded-xl border border-charcoal-border/60 bg-white hover:bg-sage-50 text-charcoal-muted hover:text-charcoal shadow-soft-sm transition-colors shrink-0"
            title="Refresh Leads"
            aria-label="Refresh Leads"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sage-600' : ''}`} />
          </button>
          <Link
            href="/admin"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-sage-500 hover:bg-sage-600 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-soft-sm transition-all"
          >
            <span>Manage Bookings</span>
          </Link>
        </div>
      </div>

      {/* Supabase not configured notice */}
      {!isConfigured && (
        <div className="p-4 rounded-xl bg-sage-50/80 border border-sage-200 text-charcoal text-xs flex items-start gap-3">
          <div className="w-6 h-6 rounded-lg bg-sage-200/80 text-sage-800 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="font-semibold text-charcoal">Supabase Live Connection Ready</p>
            <p className="text-charcoal-muted mt-0.5">
              Set <code className="font-mono bg-white px-1 py-0.5 rounded border border-sage-200">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
              <code className="font-mono bg-white px-1 py-0.5 rounded border border-sage-200">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{' '}
              <code className="font-mono bg-white px-1 py-0.5 rounded border border-sage-200">.env.local</code> to stream live leads.
            </p>
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <section aria-label="Lead Metrics" className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-6">
        <div className="bg-white rounded-xl p-3.5 sm:p-5 border border-charcoal-border/60 shadow-soft-sm hover:shadow-soft-md transition-all duration-200">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
              Total Leads
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-sage-50 text-sage-700 flex items-center justify-center border border-sage-100 shrink-0">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-charcoal">
              {metrics.total}
            </span>
            <span className="text-[11px] sm:text-xs text-charcoal-muted">
              {metrics.total === 1 ? 'enquiry' : 'enquiries'}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-charcoal-muted/80 mt-2 pt-2 border-t border-charcoal-border/30">
            All time captured
          </p>
        </div>

        <div className="bg-white rounded-xl p-3.5 sm:p-5 border border-charcoal-border/60 shadow-soft-sm hover:shadow-soft-md transition-all duration-200">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-amber-800">
              In Funnel
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/60 shrink-0">
              <Inbox className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-900">
              {metrics.active}
            </span>
            <span className="text-[11px] sm:text-xs text-charcoal-muted">open</span>
          </div>
          <p className="text-[11px] sm:text-xs text-charcoal-muted/80 mt-2 pt-2 border-t border-charcoal-border/30">
            {statusCounts.new} new &bull; {statusCounts.in_progress} in progress
          </p>
        </div>

        <div className="bg-white rounded-xl p-3.5 sm:p-5 border border-charcoal-border/60 shadow-soft-sm hover:shadow-soft-md transition-all duration-200">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Converted
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-700">
              {metrics.converted}
            </span>
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-700/80">
              ({metrics.conversionRate}% rate)
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-charcoal-muted/80 mt-2 pt-2 border-t border-charcoal-border/30">
            Became booked appointments
          </p>
        </div>

        <div className="bg-white rounded-xl p-3.5 sm:p-5 border border-charcoal-border/60 shadow-soft-sm hover:shadow-soft-md transition-all duration-200">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-red-700">
              Lost
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-200/60 shrink-0">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 rotate-180" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-red-600">
              {metrics.lost}
            </span>
            <span className="text-[11px] sm:text-xs text-charcoal-muted">dropped</span>
          </div>
          <p className="text-[11px] sm:text-xs text-charcoal-muted/80 mt-2 pt-2 border-t border-charcoal-border/30">
            Did not proceed to booking
          </p>
        </div>
      </section>

      {/* Pipeline Distribution Bar */}
      <section
        aria-label="Pipeline Distribution"
        className="bg-white rounded-2xl p-4 sm:p-5 border border-charcoal-border/60 shadow-soft-sm space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-sage-600" />
            <h3 className="text-sm sm:text-base font-bold text-charcoal">Pipeline Distribution</h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] sm:text-xs font-semibold flex-wrap">
            {LEAD_STATUS_ORDER.map((status) => (
              <div key={status} className="flex items-center gap-1.5 text-charcoal-muted">
                <span className={`w-2.5 h-2.5 rounded-full ${LEAD_STATUS_STYLES[status].dot}`} />
                <span>
                  {LEAD_STATUS_LABELS[status]} ({statusCounts[status]})
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full h-3 bg-charcoal-surface rounded-full overflow-hidden flex shadow-inner">
          {metrics.total === 0 ? (
            <div className="w-full bg-charcoal-border/40" />
          ) : (
            LEAD_STATUS_ORDER.map((status) =>
              statusCounts[status] > 0 ? (
                <div
                  key={status}
                  style={{ width: `${(statusCounts[status] / metrics.total) * 100}%` }}
                  className={`${LEAD_STATUS_STYLES[status].bar} transition-all duration-500`}
                  title={`${LEAD_STATUS_LABELS[status]}: ${statusCounts[status]}`}
                />
              ) : null
            )
          )}
        </div>
      </section>

      {/* Filters: status tabs + search */}
      <section aria-label="Lead Filters" className="space-y-3">
        <div className="flex items-center gap-1.5 p-1 bg-[#FAF9F6] border border-charcoal-border/70 rounded-2xl overflow-x-auto shadow-soft-sm">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'all'
                ? 'bg-white text-charcoal shadow-soft-sm border border-charcoal-border/80'
                : 'text-charcoal-muted hover:text-charcoal hover:bg-white/60'
            }`}
          >
            <span>All</span>
            <span
              className={`px-1.5 rounded-full text-[10px] font-bold ${
                statusFilter === 'all'
                  ? 'bg-sage-100 text-sage-800'
                  : 'bg-charcoal-border/40 text-charcoal-muted'
              }`}
            >
              {leads.length}
            </span>
          </button>

          {LEAD_STATUS_ORDER.map((status) => {
            const isActive = statusFilter === status;
            const style = LEAD_STATUS_STYLES[status];
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  isActive
                    ? `${style.tab} shadow-soft-sm`
                    : 'border-transparent text-charcoal-muted hover:text-charcoal hover:bg-white/60'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                <span>{LEAD_STATUS_LABELS[status]}</span>
                <span
                  className={`px-1.5 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-white/70 text-charcoal' : 'bg-charcoal-border/40 text-charcoal-muted'
                  }`}
                >
                  {statusCounts[status]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-muted">
            <Search className="w-4 h-4 text-sage-600" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, @handle, phone, email, address, vehicle, or message…"
            className="w-full pl-10 pr-10 py-2.5 rounded-xl text-base sm:text-sm bg-white border border-charcoal-border text-charcoal placeholder:text-charcoal-light/70 focus:border-sage-500 transition-colors shadow-soft-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-charcoal-muted hover:text-charcoal"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-charcoal-muted">
          <span>
            Showing <strong className="text-charcoal font-semibold">{filteredLeads.length}</strong> of{' '}
            {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
          </span>
          {(statusFilter !== 'all' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setSearchQuery('');
              }}
              className="text-sage-700 hover:text-sage-900 underline hover:no-underline font-medium"
            >
              Reset filters
            </button>
          )}
        </div>
      </section>

      {/* Lead Cards */}
      <section aria-label="Lead List">
        {filteredLeads.length === 0 ? (
          <div className="bg-white rounded-xl p-8 sm:p-12 text-center border border-charcoal-border/60 shadow-soft-sm">
            <div className="w-12 h-12 rounded-2xl bg-sage-50 text-sage-600 flex items-center justify-center mx-auto mb-4 border border-sage-100">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-charcoal mb-1">
              {leads.length === 0 ? 'No leads captured yet' : 'No leads match these filters'}
            </h3>
            <p className="text-xs sm:text-sm text-charcoal-muted max-w-md mx-auto">
              {leads.length === 0
                ? 'Inbound Instagram enquiries will appear here automatically as the automation captures them, newest conversation first.'
                : 'Try a different status tab or clear the search to see more leads.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredLeads.map((lead) => {
              const isUpdating = updatingId === lead.id;
              const style = LEAD_STATUS_STYLES[lead.lead_status];
              const ig = resolveInstagram(lead.instagram_user_id, lead.instagram_username);

              return (
                <div
                  key={lead.id}
                  className="bg-white rounded-xl p-3.5 sm:p-5 border border-charcoal-border/60 shadow-soft-sm hover:shadow-soft-md hover:border-sage-300/80 transition-all duration-200 space-y-3"
                >
                  {/* Row 1: identity + contact chips + status */}
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-charcoal tracking-tight mr-1">
                      {leadDisplayName(lead)}
                    </h3>

                    {ig?.handle ? (
                      <a
                        href={ig.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200/80 transition-colors active:scale-95"
                        title={`Instagram profile: @${ig.handle}`}
                      >
                        <Instagram className="w-3.5 h-3.5 text-pink-600 shrink-0" />
                        <span>@{ig.handle}</span>
                      </a>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-charcoal-surface text-charcoal-muted border border-charcoal-border/50"
                        title="Instagram account ID from the automation (no username captured yet)"
                      >
                        <Instagram className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-mono">{ig?.accountId || lead.instagram_user_id}</span>
                      </span>
                    )}

                    {lead.client_no && (
                      <a
                        href={`tel:${lead.client_no.replace(/[^0-9+]/g, '')}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sage-100/90 text-sage-800 hover:bg-sage-200/90 border border-sage-300/80 transition-colors active:scale-95"
                        title={`Call lead: ${lead.client_no}`}
                      >
                        <Phone className="w-3.5 h-3.5 text-sage-700 shrink-0" />
                        <span>{lead.client_no}</span>
                      </a>
                    )}

                    {lead.email && (
                      <a
                        href={`mailto:${lead.email}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200/70 transition-colors"
                        title={`Email lead: ${lead.email}`}
                      >
                        <Mail className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span className="truncate max-w-[180px]">{lead.email}</span>
                      </a>
                    )}

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style.badge} ml-auto`}
                    >
                      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                      {LEAD_STATUS_LABELS[lead.lead_status]}
                    </span>
                  </div>

                  {/* Row 2: qualification details */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {lead.service && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-semibold bg-sage-50 text-sage-800 border border-sage-200">
                        {SERVICE_LABELS[lead.service] || lead.service}
                      </span>
                    )}

                    {(lead.car_type || lead.vehicle_make_model || lead.car_count) && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-medium bg-charcoal-surface text-charcoal-muted border border-charcoal-border/50">
                        <Car className="w-3 h-3 shrink-0" />
                        <span>
                          {lead.car_count && lead.car_count > 1 ? `${lead.car_count}x ` : ''}
                          {lead.vehicle_make_model ||
                            (lead.car_type ? CAR_TYPE_LABELS[lead.car_type] : 'Vehicle')}
                        </span>
                      </span>
                    )}

                    {lead.price !== undefined && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <DollarSign className="w-3 h-3 shrink-0" />
                        <span>{lead.price.toFixed(2)}</span>
                      </span>
                    )}

                    {lead.pet_hair && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-medium bg-orange-50 text-orange-700 border border-orange-200/70">
                        <PawPrint className="w-3 h-3 shrink-0" />
                        <span>Pet Hair</span>
                      </span>
                    )}

                    {lead.has_power && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/70">
                        <Zap className="w-3 h-3 text-amber-600 shrink-0" />
                        Power
                      </span>
                    )}

                    {lead.has_water && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-sky-50 text-sky-800 border border-sky-200/70">
                        <Droplet className="w-3 h-3 text-sky-600 shrink-0" />
                        Water
                      </span>
                    )}
                  </div>

                  {/* Row 3: logistics */}
                  {(lead.address || lead.booking_date || lead.booking_time) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 text-xs text-charcoal-muted">
                      {(lead.booking_date || lead.booking_time) && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {lead.booking_date && (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-sage-600 shrink-0" />
                              <span className="font-medium text-charcoal">
                                {formatDisplayDate(lead.booking_date)}
                              </span>
                            </div>
                          )}
                          {lead.booking_date && lead.booking_time && (
                            <span className="text-charcoal-border">|</span>
                          )}
                          {lead.booking_time && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-sage-600 shrink-0" />
                              <span>{formatDisplayTime(lead.booking_time)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {lead.address && (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-sage-600 shrink-0" />
                          <span className="truncate text-charcoal/90" title={lead.address}>
                            {lead.address}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Row 4: latest message */}
                  {lead.last_message && (
                    <div className="p-2.5 rounded-xl bg-[#FAF9F6] border border-charcoal-border/50 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-charcoal-muted">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <MessageSquare className="w-3 h-3 text-sage-600 shrink-0" />
                          Latest message
                        </span>
                        <span>
                          {lead.message_count} {lead.message_count === 1 ? 'msg' : 'msgs'} &bull;{' '}
                          {formatRelativeTime(lead.last_message_at)}
                        </span>
                      </div>
                      <p className="text-charcoal/90 line-clamp-3 leading-relaxed">
                        {lead.last_message}
                      </p>
                    </div>
                  )}

                  {/* Row 5: notes */}
                  {lead.notes && (
                    <div className="flex items-start gap-1.5 text-xs text-charcoal-muted">
                      <StickyNote className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span className="text-charcoal/90">{lead.notes}</span>
                    </div>
                  )}

                  {/* Row 6: actions */}
                  <div className="pt-2 border-t border-charcoal-border/30 flex flex-wrap items-center gap-2">
                    <label
                      htmlFor={`lead_status_${lead.id}`}
                      className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-muted"
                    >
                      Stage:
                    </label>
                    <select
                      id={`lead_status_${lead.id}`}
                      value={lead.lead_status}
                      disabled={isUpdating}
                      onChange={(e) => handleStatusChange(lead, e.target.value as LeadStatus)}
                      className="px-3 py-2 sm:py-1.5 rounded-lg text-sm sm:text-xs font-semibold bg-[#FAF9F6] border border-charcoal-border text-charcoal focus:border-sage-500 focus:bg-white transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {LEAD_STATUS_ORDER.map((status) => (
                        <option key={status} value={status}>
                          {LEAD_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>

                    {isUpdating && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-sage-700">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Updating…</span>
                      </span>
                    )}

                    {lead.booking_id && (
                      <Link
                        href="/admin"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/70 transition-colors"
                        title="This lead was converted into a booking"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>View booking</span>
                      </Link>
                    )}

                    <span className="text-[11px] text-charcoal-muted ml-auto">
                      First seen {formatRelativeTime(lead.created_at)}
                    </span>

                    <button
                      type="button"
                      onClick={() => setDeletingLead(lead)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 active:scale-95 rounded-lg border border-red-200/60 transition-all"
                      aria-label={`Delete lead ${leadDisplayName(lead)}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingLead)}
        title="Delete Lead"
        message={`Are you sure you want to delete the lead for ${
          deletingLead ? leadDisplayName(deletingLead) : ''
        }? This action cannot be undone.`}
        confirmLabel="Delete Lead"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingLead(null)}
      />
    </div>
  );
}
