-- Web Push to detailers when a job lands on the open board.
--
-- The chain: a booking is inserted (or handed back) with no detailer ->
-- trg_bookings_notify_new_job -> pg_net POSTs to the portal's
-- /api/push/new-job route on Vercel -> it calls push_dispatch() for the
-- payload and the device list, sends the pushes, and calls push_report() to
-- log the outcome -> the detailer taps it and lands on the board.
--
-- The sender runs on Vercel with no service-role key and no env secrets. It
-- proves itself with x-push-secret, and push_dispatch() only answers a caller
-- who presents the right one. Two secrets live in Vault, NOT in this file
-- (this repo is public):
--   vapid_private_key    - signs the pushes; its public half is in the portal
--   push_webhook_secret  - shared between the trigger and the route
-- They were inserted with vault.create_secret() by hand. To rotate, update
-- the Vault row; nothing else holds the value.
--
-- Prerequisite, in its own transaction: notification_type gains 'job_offered'.

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Where a detailer's phone registers itself
-- ---------------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  detailer_id  uuid not null references public.detailers(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_detailer_idx on public.push_subscriptions (detailer_id);

alter table public.push_subscriptions enable row level security;

-- A detailer manages only their own devices. Identity, not active status: an
-- inactive detailer can still remove a device, they just will not be sent to.
drop policy if exists "Detailers manage their own push subscriptions" on public.push_subscriptions;
create policy "Detailers manage their own push subscriptions"
  on public.push_subscriptions for all to authenticated
  using (detailer_id = public.current_detailer_id())
  with check (detailer_id = public.current_detailer_id());

drop policy if exists "Admins see push subscriptions" on public.push_subscriptions;
create policy "Admins see push subscriptions"
  on public.push_subscriptions for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. What the sender is allowed to know, gated by the shared secret
-- ---------------------------------------------------------------------------

create or replace function public.push_secret_ok(p_secret text)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $fn$
  select p_secret is not null
     and length(p_secret) >= 32
     and p_secret = (select decrypted_secret from vault.decrypted_secrets where name = 'push_webhook_secret');
$fn$;
revoke all on function public.push_secret_ok(text) from public;

-- Everything the route needs for one job, in one call: the signing key, the
-- notification text (no customer name, no street - it can sit on a lock
-- screen) and every device belonging to an active detailer with a login.
-- Returns null if the secret is wrong or the job is no longer on the board.
create or replace function public.push_dispatch(p_secret text, p_booking_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $fn$
declare
  v_b     bookings;
  v_body  text;
  v_area  text;
  v_when  text;
  v_subs  jsonb;
begin
  if not public.push_secret_ok(p_secret) then
    return null;
  end if;

  select * into v_b from bookings where id = p_booking_id;
  if v_b.id is null or v_b.assigned_detailer_id is not null or v_b.status <> 'scheduled' then
    return jsonb_build_object('skipped', 'no longer on the board');
  end if;

  v_area := case
    when v_b.service_location = 'shop' or v_b.address like 'In-shop%' then 'At our shop'
    when v_b.address is null or btrim(v_b.address) = '' then 'Area not given'
    when position(',' in v_b.address) > 0 then btrim(substring(v_b.address from position(',' in v_b.address) + 1))
    else 'Area shown on the board'
  end;

  v_when := to_char(v_b.booking_date, 'Dy DD Mon') || ', ' || trim(leading '0' from to_char(v_b.booking_time, 'HH12:MI AM'));

  v_body := (case v_b.service
               when 'interior_silver' then 'Interior Silver' when 'interior_gold' then 'Interior Gold'
               when 'full_silver' then 'Full Silver'         when 'full_gold' then 'Full Gold'
               when 'ceramic_tint' then 'Ceramic Tint'       when 'nano_ceramic_tint' then 'Nano Ceramic Tint'
               else v_b.service::text end)
          || ' · ' || (case when v_b.car_count > 1 then v_b.car_count || ' × ' else '' end)
          || (case v_b.car_type
                when 'sedan' then 'Sedan' when 'hatchback' then 'Hatchback' when 'suv' then 'SUV'
                when 'van' then 'Van' when 'mini_truck' then 'Mini truck' else 'Vehicle' end)
          || ' · ' || v_area || E'\n' || v_when;

  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]'::jsonb)
    into v_subs
  from push_subscriptions s
  join detailers d on d.id = s.detailer_id
  where d.status = 'active' and d.auth_user_id is not null;

  return jsonb_build_object(
    'vapid_private_key', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private_key'),
    'payload', jsonb_build_object('title', 'New job up for grabs', 'body', v_body, 'url', '/jobs', 'tag', 'job-' || v_b.id),
    'subscriptions', v_subs
  );
end;
$fn$;

-- Writes the audit row and forgets devices the push service said are gone.
create or replace function public.push_report(
  p_secret text, p_booking_id uuid, p_message text,
  p_sent integer, p_total integer, p_removed_ids uuid[], p_failures text
)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  if not public.push_secret_ok(p_secret) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if array_length(p_removed_ids, 1) > 0 then
    delete from push_subscriptions where id = any(p_removed_ids);
  end if;

  insert into notifications (booking_id, type, status, message, error)
  values (
    p_booking_id, 'job_offered',
    (case when p_total = 0 then 'skipped' when p_sent > 0 then 'sent' else 'failed' end)::notification_status,
    p_message,
    case when p_total = 0 then 'No detailer has notifications turned on'
         else 'sent ' || p_sent || '/' || p_total
              || case when array_length(p_removed_ids, 1) > 0 then ', removed ' || array_length(p_removed_ids, 1) || ' stale' else '' end
              || case when p_failures <> '' then ', failed: ' || p_failures else '' end
    end
  );
end;
$fn$;

-- Callable with the anon key: the secret argument is the gate, not the role.
grant execute on function public.push_dispatch(text, uuid) to anon, authenticated;
grant execute on function public.push_report(text, uuid, text, integer, integer, uuid[], text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. The trigger
-- Fires for a job that is on the board and worth offering: unassigned,
-- scheduled, not in the past, inside booking hours. On UPDATE only when the
-- job has just come back (a decline or an unassign), so an unrelated edit to
-- a job already sitting on the board does not re-notify everyone.
-- ---------------------------------------------------------------------------

create or replace function public.notify_new_job()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_secret text;
begin
  if new.assigned_detailer_id is not null
     or new.status <> 'scheduled'
     or new.booking_date < current_date
     or new.booking_time < '09:00' or new.booking_time > '17:00' then
    return null;
  end if;

  if tg_op = 'UPDATE' and old.assigned_detailer_id is null then
    return null;
  end if;

  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  if v_secret is null then
    raise warning 'notify_new_job: push_webhook_secret missing from vault, skipping';
    return null;
  end if;

  perform net.http_post(
    url     := 'https://detailer-portal.vercel.app/api/push/new-job',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body    := jsonb_build_object('booking_id', new.id, 'event', tg_op)
  );

  return null;
end;
$fn$;

drop trigger if exists trg_bookings_notify_new_job on public.bookings;
create trigger trg_bookings_notify_new_job
after insert or update of assigned_detailer_id on public.bookings
for each row execute function public.notify_new_job();
