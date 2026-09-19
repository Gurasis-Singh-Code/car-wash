-- Booking fees: the detailer collects the full amount from the customer and
-- owes Absolute a fixed fee per completed job.
--
--   Gold interior $30 · Gold full $37 · Titanium interior $39 · Titanium full $46
--   Add-ons (pet hair, engine bay, out-of-area) are the detailer's to keep.
--   No fee on a cancelled job. Fees are invoiced weekly, Monday to Sunday.
--
-- This replaces the old direction entirely. detailer_payouts recorded money
-- owed TO a detailer, under the assumption that the business collected and
-- paid wages. It was never used - zero rows - so it is dropped rather than
-- left as a second, contradictory model.
--
-- The fee row is written by a trigger the moment a booking becomes completed,
-- so the number a detailer sees is the number the office sees, and neither is
-- typed in by hand. Only bookings completed from now on get a row: the trigger
-- fires on the transition, and the 18 jobs already completed under the old
-- model are deliberately left alone.

drop table if exists public.detailer_payouts;
drop type if exists public.payout_status;

create type public.fee_status as enum ('owed', 'paid');

-- ---------------------------------------------------------------------------
-- 1. The schedule
-- Fixed per package. A retired package (Silver, tint) has no fixed fee, so it
-- gets the same ~23% the schedule works out to, rounded to the dollar - there
-- are two such bookings still to run and they should not be free.
-- ---------------------------------------------------------------------------

create or replace function public.booking_fee_for(p_service public.service_type, p_price numeric)
returns numeric
language sql immutable
as $fn$
  select case p_service
    when 'interior_gold'     then 30
    when 'full_gold'         then 37
    when 'interior_titanium' then 39
    when 'full_titanium'     then 46
    else round(coalesce(p_price, 0) * 0.23)
  end;
$fn$;

-- ---------------------------------------------------------------------------
-- 2. The ledger
-- ---------------------------------------------------------------------------

create table public.booking_fees (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null unique references public.bookings(id) on delete cascade,
  detailer_id     uuid not null references public.detailers(id),
  service         public.service_type not null,
  -- What the detailer collected from the customer, in full, at the job.
  customer_total  numeric(10,2) not null,
  -- What they owe Absolute for this job.
  fee_amount      numeric(10,2) not null,
  status          public.fee_status not null default 'owed',
  completed_on    date not null,
  -- Monday of the week the job was completed. Fees are invoiced by this.
  week_start      date not null,
  paid_at         timestamptz,
  paid_note       text,
  created_at      timestamptz not null default now()
);

create index booking_fees_detailer_week_idx on public.booking_fees (detailer_id, week_start desc);
create index booking_fees_status_idx on public.booking_fees (status) where status = 'owed';

alter table public.booking_fees enable row level security;

-- Identity, not active status: someone taken off the roster still owes what
-- they owe, and needs to be able to see it.
create policy "Detailers see their own fees"
  on public.booking_fees for select to authenticated
  using (detailer_id = public.current_detailer_id());

create policy "Admins manage fees"
  on public.booking_fees for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. Written on completion, withdrawn on un-completion
-- ---------------------------------------------------------------------------

create or replace function public.sync_booking_fee()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_total numeric;
begin
  -- Became completed with a detailer on it: record the fee. ON CONFLICT so a
  -- second completion (after a revert) does not double-charge.
  if new.status = 'completed' and old.status is distinct from 'completed'
     and new.assigned_detailer_id is not null then
    v_total := coalesce(new.price, 0) + coalesce(new.engine_bay_fee, 0) + coalesce(new.out_of_area_fee, 0);
    insert into public.booking_fees
      (booking_id, detailer_id, service, customer_total, fee_amount, completed_on, week_start)
    values
      (new.id, new.assigned_detailer_id, new.service, v_total,
       public.booking_fee_for(new.service, new.price),
       current_date, date_trunc('week', current_date)::date)
    on conflict (booking_id) do nothing;
  end if;

  -- Stopped being completed: withdraw the fee, but only if it has not been
  -- paid. A paid fee against a job later un-completed is a conversation, not
  -- something to silently erase.
  if old.status = 'completed' and new.status is distinct from 'completed' then
    delete from public.booking_fees where booking_id = new.id and status = 'owed';
  end if;

  return null;
end;
$fn$;

drop trigger if exists trg_bookings_sync_fee on public.bookings;
create trigger trg_bookings_sync_fee
after update of status on public.bookings
for each row execute function public.sync_booking_fee();

-- ---------------------------------------------------------------------------
-- 4. Settling a week
-- The admin marks a detailer's whole week paid when the e-transfer lands.
-- ---------------------------------------------------------------------------

create or replace function public.admin_mark_week_paid(p_detailer_id uuid, p_week_start date, p_note text default null)
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  update public.booking_fees
     set status = 'paid', paid_at = now(), paid_note = p_note
   where detailer_id = p_detailer_id
     and week_start = p_week_start
     and status = 'owed';

  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

create or replace function public.admin_mark_week_owed(p_detailer_id uuid, p_week_start date)
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  update public.booking_fees
     set status = 'owed', paid_at = null, paid_note = null
   where detailer_id = p_detailer_id
     and week_start = p_week_start
     and status = 'paid';

  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

revoke execute on function public.admin_mark_week_paid(uuid, date, text) from public;
revoke execute on function public.admin_mark_week_owed(uuid, date) from public;
grant execute on function public.admin_mark_week_paid(uuid, date, text) to authenticated;
grant execute on function public.admin_mark_week_owed(uuid, date) to authenticated;
