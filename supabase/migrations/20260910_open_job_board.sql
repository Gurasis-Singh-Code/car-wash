-- ==============================================================================
-- OPEN JOB BOARD
-- A booking taken by the Instagram assistant used to sit in the Unassigned queue
-- until the owner picked someone. Now it is offered to every active detailer at
-- once and the first to claim it gets it, after which the customer is sent an
-- Instagram confirmation automatically.
--
-- The assistant's own wording does not change. It still says it will confirm and
-- come back, because at the moment it speaks nobody has taken the job yet.
--
-- Idempotent: safe to run more than once. Depends on 20260909_detailer_portal.sql.
-- ==============================================================================

begin;

-- ==============================================================================
-- 1. WHEN A JOB WENT ON THE BOARD
-- offered_at is the clock behind "nobody has taken this in two hours". It is set
-- when a booking is created without a detailer, re-set when one is handed back
-- (so a declined job gets a fresh two hours rather than alerting instantly), and
-- cleared the moment somebody holds it.
--
-- Done in triggers rather than in application code because bookings are created
-- from three places - the admin panel, the Instagram assistant's Supabase tool,
-- and by hand in SQL - and only the database sees all three.
-- ==============================================================================
alter table bookings add column if not exists offered_at timestamptz;

-- Existing unassigned work joins the board dated from when it was created, which
-- is honest: those jobs really have been sitting unclaimed since then.
update bookings
set offered_at = coalesce(offered_at, created_at)
where assigned_detailer_id is null and status = 'scheduled';

create index if not exists bookings_open_offers_idx
  on bookings (offered_at)
  where assigned_detailer_id is null and status = 'scheduled';

create or replace function public.sync_offered_at()
returns trigger
language plpgsql
as $fn$
begin
  if tg_op = 'INSERT' then
    if new.assigned_detailer_id is null then
      new.offered_at := coalesce(new.offered_at, now());
    end if;
    return new;
  end if;

  if new.assigned_detailer_id is null and old.assigned_detailer_id is not null then
    new.offered_at := now();
  elsif new.assigned_detailer_id is not null then
    new.offered_at := null;
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_bookings_offered_at_ins on bookings;
create trigger trg_bookings_offered_at_ins
before insert on bookings
for each row execute function public.sync_offered_at();

drop trigger if exists trg_bookings_offered_at_upd on bookings;
create trigger trg_bookings_offered_at_upd
before update of assigned_detailer_id on bookings
for each row execute function public.sync_offered_at();

-- ==============================================================================
-- 2. WHAT AN UNCLAIMED JOB SHOWS
-- Every active detailer can see an open job, so an open job must not carry the
-- customer's street address around on five phones belonging to people who will
-- not end up doing it. The full address appears once somebody claims it.
--
-- Everything after the first comma: "482 Trafalgar Rd, Oakville, ON" becomes
-- "Oakville, ON", which is enough to judge the travel and nothing more. An
-- address with no comma gives away nothing useful, so it is withheld entirely
-- rather than guessed at.
--
-- notes is withheld for the same reason and is NOT in the returned columns.
-- Notes are where gate codes and access instructions live ("Gate code 4417"),
-- and those have no business sitting on the phone of every detailer who looked
-- at the job and passed. The pills that ARE returned - pet hair, power, water,
-- engine bay - carry everything needed to decide whether to take it, and the
-- notes appear on the full job card the moment somebody does.
-- ==============================================================================
create or replace function public.coarse_area(p_address text)
returns text
language sql immutable
as $fn$
  select case
    when p_address is null or btrim(p_address) = '' then 'Area not given'
    when p_address like 'In-shop%' then 'At our shop'
    when position(',' in p_address) > 0
      then btrim(substring(p_address from position(',' in p_address) + 1))
    else 'Area shown once claimed'
  end;
$fn$;

-- security definer, and NOT a widened RLS policy on bookings. A policy grants
-- whole rows, so letting detailers select unclaimed bookings directly would hand
-- them the address, the phone number and the email as well. Going through a
-- function is what makes the redaction real rather than cosmetic.
-- Dropped rather than replaced: Postgres will not let CREATE OR REPLACE change
-- the OUT parameters of a set-returning function, and removing notes changes
-- exactly that.
drop function if exists public.detailer_open_jobs();

create function public.detailer_open_jobs()
returns table (
  id uuid,
  service text,
  service_location text,
  car_type text,
  car_count integer,
  vehicle_make_model text,
  booking_date date,
  booking_time time,
  price numeric,
  engine_bay_fee numeric,
  out_of_area_fee numeric,
  pet_hair boolean,
  has_power boolean,
  has_water boolean,
  area text,
  offered_at timestamptz
)
language sql stable security definer set search_path = public, pg_temp
as $fn$
  select b.id, b.service::text, b.service_location::text, b.car_type::text,
         b.car_count, b.vehicle_make_model, b.booking_date, b.booking_time,
         b.price, b.engine_bay_fee, b.out_of_area_fee, b.pet_hair,
         b.has_power, b.has_water,
         public.coarse_area(b.address), b.offered_at
  from bookings b
  where b.assigned_detailer_id is null
    and b.status = 'scheduled'
    and b.booking_date >= current_date
    and public.current_active_detailer_id() is not null
  order by b.booking_date asc, b.booking_time asc;
$fn$;

-- ==============================================================================
-- 3. CLAIMING, AND THE RACE
-- Two detailers tapping Claim on the same job at the same moment is the normal
-- case, not the edge case, because they were both looking at the same list.
--
-- `and assigned_detailer_id is null` inside the UPDATE is what settles it. The
-- second transaction blocks on the row lock, re-reads the committed row, finds
-- the column no longer null, matches nothing, and raises. There is no window
-- between checking and writing, which a SELECT-then-UPDATE would have.
-- ==============================================================================
create or replace function public.detailer_claim_booking(p_booking_id uuid)
returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_detailer uuid;
  v_name text;
  v_count integer;
begin
  select d.id, d.name into v_detailer, v_name
  from detailers d
  where d.auth_user_id = auth.uid() and d.status = 'active';

  if v_detailer is null then
    raise exception 'No active detailer for this account' using errcode = '42501';
  end if;

  update bookings
  set assigned_detailer_id = v_detailer,
      assigned_detailer = v_name,
      assignment_status = 'accepted',
      assignment_responded_at = now()
  where id = p_booking_id
    and assigned_detailer_id is null
    and status = 'scheduled'
    and booking_date >= current_date;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Someone else took this job' using errcode = '55006';
  end if;

  return true;
end;
$fn$;

-- ==============================================================================
-- 3b. THE TRIGGER HAD TO LEARN THE DIFFERENCE
-- sync_assignment_status (from the detailer portal migration) forces
-- assignment_status to 'pending' whenever assigned_detailer_id changes, because
-- an assignment made by the owner is by definition awaiting the detailer's
-- reply. A claim also changes assigned_detailer_id — so the trigger was
-- overwriting the 'accepted' that detailer_claim_booking had just set.
--
-- The effect was silent and total: every claimed job sat as 'pending', the
-- confirmation queue (which requires 'accepted') stayed empty forever, and the
-- detailer who had just taken a job saw it labelled "Needs a reply".
--
-- Now the trigger only imposes 'pending' when the caller did not say. An UPDATE
-- that explicitly sets a new assignment_status is taken at its word:
--
--   owner assigns   old null      -> new null (not in SET list)  => forced pending
--   detailer claims old null      -> new 'accepted'              => left alone
--   owner reassigns old 'accepted'-> new 'accepted' (unchanged)  => forced pending
--
-- That last line matters: moving an accepted job to a different detailer must
-- reset the handshake, because the new one has agreed to nothing.
-- ==============================================================================
create or replace function public.sync_assignment_status()
returns trigger
language plpgsql
as $fn$
begin
  if new.assigned_detailer_id is distinct from old.assigned_detailer_id then
    if new.assigned_detailer_id is null then
      new.assignment_status := null;
      new.assignment_responded_at := null;
    elsif new.assignment_status is not distinct from old.assignment_status then
      new.assignment_status := 'pending';
      new.assignment_responded_at := null;
    end if;
  end if;
  return new;
end;
$fn$;

revoke execute on function public.detailer_open_jobs() from public;
revoke execute on function public.detailer_claim_booking(uuid) from public;
revoke execute on function public.coarse_area(text) from public;
grant execute on function public.detailer_open_jobs() to authenticated;
grant execute on function public.detailer_claim_booking(uuid) to authenticated;
grant execute on function public.coarse_area(text) to authenticated, service_role;

-- ==============================================================================
-- 4. QUEUES FOR n8n
-- Both are polled rather than pushed, matching how the reminders workflow
-- already works, and both are de-duplicated against the notifications table so a
-- customer cannot be confirmed twice and the owner cannot be nagged twice about
-- the same job.
--
-- The confirmation queue requires assignment_status = 'accepted', not merely an
-- assigned detailer. A job the owner assigned that the detailer has not answered
-- yet is not confirmed work: they may still decline it, and telling the customer
-- it is booked before anyone has agreed to do it is the one mistake this whole
-- feature exists to avoid.
--
-- hours_since_last_message is carried through for Meta's 24 hour messaging
-- window, exactly as get_due_notifications does.
-- ==============================================================================
create or replace function public.get_pending_confirmations()
returns table (
  booking_id uuid,
  instagram_user_id text,
  instagram_username text,
  customer_name text,
  detailer_name text,
  booking_date date,
  booking_time time,
  address text,
  service text,
  service_location text,
  car_count integer,
  price numeric,
  engine_bay_fee numeric,
  out_of_area_fee numeric,
  last_message_at timestamptz,
  hours_since_last_message numeric
)
language sql stable security definer set search_path = public, pg_temp
as $fn$
  select b.id, b.instagram_user_id, b.instagram_username, b.customer_name,
         b.assigned_detailer, b.booking_date, b.booking_time, b.address,
         b.service::text, b.service_location::text, b.car_count,
         b.price, b.engine_bay_fee, b.out_of_area_fee,
         l.last_message_at,
         case when l.last_message_at is null then null
              else round(extract(epoch from (now() - l.last_message_at)) / 3600.0, 2)
         end
  from bookings b
  left join leads l on l.instagram_user_id = b.instagram_user_id
  where b.assigned_detailer_id is not null
    and b.assignment_status = 'accepted'
    and b.status = 'scheduled'
    and b.instagram_user_id ~ '^[0-9]{6,}$'
    and not exists (
      select 1 from notifications n
      where n.booking_id = b.id
        and n.type = 'booking_confirmed'
        and n.status = 'sent'
    )
  order by b.assignment_responded_at asc nulls last;
$fn$;

-- Past-dated jobs are excluded from both this and the board. A job whose date has
-- gone by cannot be claimed and alerting about it is pure noise.
create or replace function public.get_unclaimed_jobs(min_minutes integer default 120)
returns table (
  booking_id uuid,
  customer_name text,
  booking_date date,
  booking_time time,
  service text,
  address text,
  price numeric,
  offered_at timestamptz,
  minutes_open numeric
)
language sql stable security definer set search_path = public, pg_temp
as $fn$
  select b.id, b.customer_name, b.booking_date, b.booking_time,
         b.service::text, b.address, b.price, b.offered_at,
         round(extract(epoch from (now() - b.offered_at)) / 60.0)
  from bookings b
  where b.assigned_detailer_id is null
    and b.status = 'scheduled'
    and b.booking_date >= current_date
    and b.offered_at is not null
    and b.offered_at <= now() - make_interval(mins => min_minutes)
    and not exists (
      select 1 from notifications n
      where n.booking_id = b.id
        and n.type = 'job_unclaimed'
        and n.status = 'sent'
    )
  order by b.offered_at asc;
$fn$;

revoke execute on function public.get_pending_confirmations() from public, authenticated;
revoke execute on function public.get_unclaimed_jobs(integer) from public, authenticated;
grant execute on function public.get_pending_confirmations() to anon, service_role;
grant execute on function public.get_unclaimed_jobs(integer) to anon, service_role;

commit;

-- notification_type gained 'booking_confirmed' and 'job_unclaimed' in
-- 20260910_notification_types_for_claims.sql. Enum values must be added in their
-- own transaction before anything references them.
