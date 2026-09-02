'use client';

import React from 'react';
import { X, Loader2, Sparkles, AlertTriangle, Send, CheckCircle2, PhoneCall } from 'lucide-react';

/** The n8n guard rejects anything longer than this before it reaches Instagram. */
const MAX_LENGTH = 900;

export interface FollowUpDraft {
  recommended: boolean;
  blocked: boolean;
  deliverable: boolean;
  undeliverable_reason: string;
  message: string;
  reason: string;
  days_quiet?: number;
}

export type FollowUpStatus = 'loading' | 'ready' | 'sending' | 'sent' | 'error';

interface FollowUpModalProps {
  isOpen: boolean;
  leadName: string;
  status: FollowUpStatus;
  draft: FollowUpDraft | null;
  error: string | null;
  message: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
}

export default function FollowUpModal({
  isOpen,
  leadName,
  status,
  draft,
  error,
  message,
  onMessageChange,
  onSend,
  onClose,
}: FollowUpModalProps) {
  if (!isOpen) return null;

  const isBusy = status === 'loading' || status === 'sending';

  // Three different reasons there may be no message, which must not look alike.
  // A model outage or a tripped guard is a technical failure; the assistant
  // judging that a lead should be left alone is a deliberate, useful call; and
  // an expired messaging window is neither. Showing an outage as "not
  // recommended" would read as advice about the customer, which it is not.
  const failedToDraft = status !== 'loading' && draft !== null && draft.blocked;
  const notRecommended =
    status !== 'loading' && draft !== null && !draft.recommended && !draft.blocked;
  const undeliverable = status !== 'loading' && draft !== null && !draft.deliverable;
  const noDraft = failedToDraft || notRecommended;

  const canSend =
    (status === 'ready' || status === 'sending') &&
    draft !== null &&
    draft.deliverable &&
    message.trim().length > 0 &&
    message.length <= MAX_LENGTH;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-charcoal/40 dark:bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-charcoal-card w-full max-w-lg rounded-2xl p-5 sm:p-6 shadow-soft-lg border border-charcoal-border animate-scale-up max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={`Follow up with ${leadName}`}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 bg-sage-100 text-sage-700">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-charcoal truncate">
                Follow up with {leadName}
              </h3>
              {draft?.days_quiet !== undefined && status !== 'loading' && (
                <p className="text-[11px] text-charcoal-muted">
                  Quiet for {draft.days_quiet} {draft.days_quiet === 1 ? 'day' : 'days'}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={status === 'sending'}
            className="text-charcoal-muted hover:text-charcoal p-1 rounded-lg hover:bg-sage-50 transition-colors disabled:opacity-40"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {status === 'loading' && (
          <div className="flex items-center gap-3 py-8 justify-center text-charcoal-muted">
            <Loader2 className="w-5 h-5 animate-spin text-sage-600" />
            <span className="text-sm">Reading the conversation and writing a follow-up…</span>
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-xl border border-red-200/70 bg-red-50 p-3.5 mb-5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-red-800 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {status === 'sent' && (
          <div className="rounded-xl border border-emerald-200/70 bg-emerald-50 p-3.5 mb-5">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-emerald-800 leading-relaxed">
                Sent, and logged against this lead so the daily automation will not chase them again straight away.
              </p>
            </div>
          </div>
        )}

        {(status === 'ready' || status === 'sending') && draft && (
          <>
            {undeliverable && (
              <div className="rounded-xl border border-amber-200/70 bg-amber-50 p-3.5 mb-4">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-900 mb-1">Cannot be sent as a DM</p>
                    <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">
                      {draft.undeliverable_reason}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!undeliverable && failedToDraft && (
              <div className="rounded-xl border border-red-200/70 bg-red-50 p-3.5 mb-4">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-red-900 mb-1">Could not write a draft</p>
                    <p className="text-xs sm:text-sm text-red-800 leading-relaxed">{draft.reason}</p>
                    <p className="text-[11px] text-red-700/90 mt-2">
                      This is a problem on our side, not a judgement about this lead. Try again in a
                      moment, or write your own message below.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!undeliverable && notRecommended && (
              <div className="rounded-xl border border-amber-200/70 bg-amber-50 p-3.5 mb-4">
                <div className="flex items-start gap-2.5">
                  <PhoneCall className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-900 mb-1">Not recommended</p>
                    <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">{draft.reason}</p>
                    <p className="text-[11px] text-amber-700/90 mt-2">
                      No message was drafted. To contact them anyway, write your own below.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!undeliverable && !noDraft && draft.reason && (
              <div className="rounded-xl border border-sage-300/60 bg-sage-50/70 p-3 mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-sage-800 mb-1">
                  Why this message
                </p>
                <p className="text-xs text-charcoal-muted leading-relaxed">{draft.reason}</p>
              </div>
            )}

            {!undeliverable && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="followup_message"
                    className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-muted"
                  >
                    Message
                  </label>
                  <span
                    className={`text-[11px] tabular-nums ${
                      message.length > MAX_LENGTH ? 'text-red-600 font-semibold' : 'text-charcoal-muted'
                    }`}
                  >
                    {message.length}/{MAX_LENGTH}
                  </span>
                </div>
                <textarea
                  id="followup_message"
                  value={message}
                  onChange={(e) => onMessageChange(e.target.value)}
                  disabled={status === 'sending'}
                  rows={5}
                  placeholder={
                    noDraft
                      ? 'Write your own message to send anyway…'
                      : 'The message that will be sent…'
                  }
                  className="w-full px-3.5 py-3 rounded-xl text-sm bg-canvas border border-charcoal-border text-charcoal placeholder:text-charcoal-muted/70 focus:border-sage-500 focus:bg-charcoal-card transition-colors resize-y disabled:opacity-60"
                />
                <p className="text-[11px] text-charcoal-muted mt-1.5">
                  You can edit this before sending. Nothing is sent until you press Send.
                </p>
              </div>
            )}
          </>
        )}

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={status === 'sending'}
            className="px-4 py-2.5 sm:py-2 text-xs sm:text-sm font-medium text-charcoal-muted hover:text-charcoal bg-sage-50/80 hover:bg-sage-100 rounded-xl transition-colors text-center disabled:opacity-50"
          >
            {status === 'sent' ? 'Close' : 'Cancel'}
          </button>

          {status !== 'sent' && status !== 'error' && !undeliverable && (
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend || isBusy}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 text-xs sm:text-sm font-semibold text-white rounded-xl shadow-soft-sm transition-all bg-sage-500 hover:bg-sage-600 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {status === 'sending' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending…</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{notRecommended ? 'Send anyway' : 'Send'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
