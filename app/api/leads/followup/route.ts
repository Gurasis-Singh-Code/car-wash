import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Server-side bridge between the leads page and the n8n follow-up workflow.
 *
 * The n8n webhook URL and its shared secret are deliberately read from
 * server-only environment variables so neither reaches the browser bundle.
 * The caller's Supabase session is verified here too, because an API route is
 * publicly reachable even when every page behind it requires a login.
 */

const N8N_URL = process.env.N8N_FOLLOWUP_WEBHOOK_URL;
const N8N_SECRET = process.env.N8N_FOLLOWUP_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Longest we will wait on n8n. The draft path runs a model call, so allow for it. */
const TIMEOUT_MS = 60_000;

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  if (!N8N_URL || !N8N_SECRET) {
    return fail(
      500,
      'Follow-ups are not configured on the server. Set N8N_FOLLOWUP_WEBHOOK_URL and N8N_FOLLOWUP_SECRET.'
    );
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return fail(500, 'Supabase is not configured on the server.');
  }

  // Verify the caller is a signed-in dashboard user, not just anyone who found
  // this endpoint. Supabase validates the JWT signature and expiry for us.
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return fail(401, 'You need to be signed in to send a follow-up.');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  // The auth client's types don't resolve in this install, so it is cast the
  // same way AuthProvider does. getUser exists at runtime and validates the JWT.
  const { data: userData, error: userError } = await (supabase as any).auth.getUser(token);
  if (userError || !userData?.user) {
    return fail(401, 'Your session has expired. Please sign in again.');
  }

  let body: { leadId?: string; mode?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return fail(400, 'Malformed request.');
  }

  const leadId = String(body.leadId || '').trim();
  const mode = body.mode === 'send' ? 'send' : 'draft';
  const message = String(body.message || '');

  if (!/^[0-9a-f-]{36}$/i.test(leadId)) {
    return fail(400, 'A valid lead is required.');
  }
  if (mode === 'send' && message.trim().length === 0) {
    return fail(400, 'Write a message before sending.');
  }
  if (message.length > 900) {
    return fail(400, 'That message is too long to send as an Instagram DM.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(N8N_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-followup-secret': N8N_SECRET,
      },
      body: JSON.stringify({ lead_id: leadId, mode, message }),
      signal: controller.signal,
      cache: 'no-store',
    });

    const text = await upstream.text();
    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch {
      return fail(502, 'The follow-up service returned an unreadable response.');
    }

    // Trust the upstream status AND its own ok flag - a 200 carrying ok:false
    // is still a failure, and must never read as success here.
    if (!upstream.ok || payload?.ok === false) {
      return NextResponse.json(
        { ok: false, error: payload?.error || 'The follow-up could not be completed.' },
        { status: upstream.ok ? 422 : upstream.status }
      );
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return fail(504, 'The follow-up service took too long to respond. Please try again.');
    }
    return fail(502, 'Could not reach the follow-up service.');
  } finally {
    clearTimeout(timer);
  }
}
