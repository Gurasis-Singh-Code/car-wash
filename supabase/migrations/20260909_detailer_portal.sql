-- ==============================================================================
-- DETAILER PORTAL
-- Adds the role boundary, assignment handshake and payout ledger that the
-- separate detailer app needs. Idempotent: safe to run more than once.
--
-- READ THIS FIRST -------------------------------------------------------------
-- Before this migration every table carried exactly one policy:
--
--     on <table> for all to authenticated using (true) with check (true)
--
-- which is fine while the only account in the project belongs to the owner. It
-- stops being fine the moment a detailer has a login: "authenticated" would let
-- them read every booking, lead, expense and notification straight from the
-- browser with the public anon key. So the first job here is to split
-- "authenticated" into ADMIN and DETAILER, and only then hand out logins.
-- ==============================================================================

begin;

-- ==============================================================================
-- 1. WHO IS AN ADMIN
-- An explicit allow-list rather than "anyone with an account", so that turning
-- on email signup, or an accidental invite, can never mint an admin.
--
-- The bootstrap insert below makes every account that exists AT MIGRATION TIME
-- an admin. Right now that is the owner login and nothing else, and it is what
-- stops this migration locking you out of your own dashboard. Detailer accounts
-- are created afterwards, so they are never swept in.
-- ==============================================================================
create table if not exists admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

insert into admin_users (user_id, email)
select u.id, u.email from auth.users u
on conflict (user_id) do nothing;

alter table admin_users enable row level security;

-- ==============================================================================
-- 2. LINKING A DETAILER TO THEIR LOGIN
-- Accounts are provisioned by the admin in the Supabase dashboard; there is no
-- signup flow. auth_user_id is the join, and it is unique so one login can never
-- be shared by two detailer records.
-- ==============================================================================
alter table detailers add column if not exists auth_user_id uuid references auth.users (id) on delete set null;
alter table detailers add column if not exists email text;

create unique index if not exists detailers_auth_user_id_unique
  on detailers (auth_user_id) where auth_user_id is not null;

-- ==============================================================================
-- 3. ROLE HELPERS
-- security definer, so a detailer can be identified without being handed read
-- access to the detailers table wholesale. stable, so the planner calls them
-- once per statement rather than once per row.
-- ==============================================================================
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admin_users a where a.user_id = auth.uid());
$$;

-- Identity only. A deactivated detailer still resolves here, which is what lets
-- them sign in and still read payouts they are owed.
create or replace function public.current_detailer_id()
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select d.id from public.detailers d where d.auth_user_id = auth.uid() limit 1;
$$;

-- Identity AND permission to work. Job access is gated on this, so flipping a
-- detailer to inactive in the admin panel is also the off switch for their
-- access to customer data.
create or replace function public.current_active_detailer_id()
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select d.id from public.detailers d
  where d.auth_user_id = auth.uid() and d.status = 'active'
  limit 1;
$$;

revoke execute on function public.is_admin() from public;
revoke execute on function public.current_detailer_id() from public;
revoke execute on function public.current_active_detailer_id() from public;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.current_detailer_id() to authenticated, service_role;
grant execute on function public.current_active_detailer_id() to authenticated, service_role;

-- Readable by admins, writable by nobody through the API. Adding an admin is a
-- deliberate service-role or SQL-editor act, not something a session can do.
drop policy if exists "Admins read the admin list" on admin_users;
create policy "Admins read the admin list"
on admin_users for select to authenticated
using (public.is_admin());

-- ==============================================================================
-- 4. THE ASSIGNMENT HANDSHAKE
-- Deliberately NOT a new value on booking_status. That enum is the job lifecycle
-- (scheduled / completed / cancelled). It is what the dashboard, the Finance
-- revenue figures and the n8n reminder queue all read, and a detailer accepting
-- a job changes none of it. Overloading it would have made accepted bookings
-- vanish from the reminder queue status = 'scheduled' filter. So acceptance gets
-- its own column.
--
-- The enum has no 'declined' member on purpose: a declined booking has no
-- detailer, so it carries assignment_status = null and is back in the unassigned
-- queue. Who bounced it is recorded separately, otherwise a job reappears in
-- that queue with no explanation.
-- ==============================================================================
do $$ begin
  create type assignment_status as enum ('pending','accepted');
exception when duplicate_object then null;
end $$;

alter table bookings add column if not exists assignment_status assignment_status;
alter table bookings add column if not exists assignment_responded_at timestamptz;
alter table bookings add column if not exists last_declined_by uuid references detailers (id) on delete set null;
alter table bookings add column if not exists last_declined_at timestamptz;

create index if not exists bookings_assignment_status_idx on bookings (assignment_status);

-- Anything already assigned when this runs is awaiting a response.
update bookings
set assignment_status = 'pending'
where assigned_detailer_id is not null and assignment_status is null;

-- Assigning from the admin panel resets the handshake; unassigning clears it.
-- Done in a trigger rather than in lib/bookings.ts so that a reassignment made
-- directly in SQL, or by any future automation, cannot leave a stale "accepted"
-- flag behind that actually belonged to the previous detailer.
create or replace function public.sync_assignment_status()
returns trigger
language plpgsql
as $$
begin
  if new.assigned_detailer_id is distinct from old.assigned_detailer_id then
    if new.assigned_detailer_id is null then
      new.assignment_status := null;
      new.assignment_responded_at := null;
    else
      new.assignment_status := 'pending';
      new.assignment_responded_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bookings_sync_assignment on bookings;
create trigger trg_bookings_sync_assignment
before update of assigned_detailer_id on bookings
for each row execute function public.sync_assignment_status();

-- ==============================================================================
-- 5. PAYOUT LEDGER
-- One row is one thing a detailer is owed, normally for one booking. Entries are
-- created by the admin by hand, keeping the existing rule that no expense and no
-- detailer pay is ever auto-generated from a booking price.
--
-- booking_id is nullable so a bonus, a tip or a correction can be recorded with
-- no job attached, and it is ON DELETE SET NULL so deleting an old booking never
-- rewrites what someone was already paid.
-- ==============================================================================
do $$ begin
  create type payout_status as enum ('pending','paid');
exception when duplicate_object then null;
end $$;

create table if not exists detailer_payouts (
  id uuid primary key default gen_random_uuid(),
  detailer_id uuid not null references detailers (id) on delete cascade,
  booking_id uuid references bookings (id) on delete set null,
  amount numeric not null check (amount >= 0),
  status payout_status not null default 'pending',
  earned_on date not null default current_date,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One payout per detailer per job, so a double entry is a database error rather
-- than a quietly doubled earnings total. Bonuses (booking_id null) are exempt.
create unique index if not exists detailer_payouts_booking_unique
  on detailer_payouts (detailer_id, booking_id) where booking_id is not null;

create index if not exists detailer_payouts_detailer_idx on detailer_payouts (detailer_id, earned_on desc);
create index if not exists detailer_payouts_status_idx on detailer_payouts (status);

drop trigger if exists detailer_payouts_touch_updated_at on detailer_payouts;
create trigger detailer_payouts_touch_updated_at
before update on detailer_payouts
for each row execute function set_updated_at();

-- ==============================================================================
-- 6. ACCEPT / DECLINE
-- Routed through security definer functions rather than an UPDATE policy,
-- because RLS grants a whole row and not a column list. A detailer holding
-- UPDATE on their own bookings could set status = 'completed', rewrite price, or
-- edit the customer address. These two functions are the only writes a detailer
-- can make to bookings, and between them they touch six columns.
-- ==============================================================================
create or replace function public.detailer_accept_booking(p_booking_id uuid)
returns bookings
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_detailer uuid;
  v_row bookings;
begin
  v_detailer := public.current_active_detailer_id();
  if v_detailer is null then
    raise exception 'No active detailer for this account' using errcode = '42501';
  end if;

  update bookings
  set assignment_status = 'accepted',
      assignment_responded_at = now()
  where id = p_booking_id
    and assigned_detailer_id = v_detailer
  returning * into v_row;

  if v_row.id is null then
    raise exception 'That job is not assigned to you' using errcode = '42501';
  end if;

  return v_row;
end;
$$;

create or replace function public.detailer_decline_booking(p_booking_id uuid)
returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_detailer uuid;
  v_count integer;
begin
  v_detailer := public.current_active_detailer_id();
  if v_detailer is null then
    raise exception 'No active detailer for this account' using errcode = '42501';
  end if;

  -- The legacy assigned_detailer text column is cleared alongside the FK,
  -- because the Overview page still groups and searches on that name.
  -- The trigger above would also null assignment_status on its own; it is set
  -- explicitly here so the intent survives if that trigger is ever dropped.
  update bookings
  set assigned_detailer_id = null,
      assigned_detailer = 'Unassigned',
      assignment_status = null,
      assignment_responded_at = null,
      last_declined_by = v_detailer,
      last_declined_at = now()
  where id = p_booking_id
    and assigned_detailer_id = v_detailer;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'That job is not assigned to you' using errcode = '42501';
  end if;

  return true;
end;
$$;

revoke execute on function public.detailer_accept_booking(uuid) from public;
revoke execute on function public.detailer_decline_booking(uuid) from public;
grant execute on function public.detailer_accept_booking(uuid) to authenticated;
grant execute on function public.detailer_decline_booking(uuid) to authenticated;

-- ==============================================================================
-- 7. THE ROLE BOUNDARY ITSELF
-- Every "Authenticated users full access" policy is replaced by an admin policy
-- of the same shape plus, where a detailer legitimately needs it, a narrow
-- read-only policy. Multiple permissive policies are OR-ed, so an admin keeps
-- unrestricted access to everything they have today.
-- ==============================================================================

-- BOOKINGS: admins everything, detailers read only the jobs assigned to them.
-- No detailer INSERT, UPDATE or DELETE policy exists at all; their only writes
-- are the two functions above.
drop policy if exists "Authenticated users full access" on bookings;
drop policy if exists "Admins full access" on bookings;
create policy "Admins full access"
on bookings for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Detailers read their own jobs" on bookings;
create policy "Detailers read their own jobs"
on bookings for select to authenticated
using (
  assigned_detailer_id is not null
  and assigned_detailer_id = public.current_active_detailer_id()
);

-- DETAILERS: admins everything, a detailer reads only their own row (needed for
-- their name and their active/inactive state). They cannot list colleagues.
drop policy if exists "Authenticated users full access" on detailers;
drop policy if exists "Admins full access" on detailers;
create policy "Admins full access"
on detailers for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Detailers read their own profile" on detailers;
create policy "Detailers read their own profile"
on detailers for select to authenticated
using (auth_user_id = auth.uid());

-- PAYOUTS: admins everything, a detailer reads only their own ledger. Read only:
-- nobody can mark their own pay as paid.
alter table detailer_payouts enable row level security;

drop policy if exists "Admins full access" on detailer_payouts;
create policy "Admins full access"
on detailer_payouts for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Detailers read their own payouts" on detailer_payouts;
create policy "Detailers read their own payouts"
on detailer_payouts for select to authenticated
using (detailer_id = public.current_detailer_id());

-- ADMIN ONLY, no detailer policy of any kind. Leads are the sales pipeline,
-- expenses and notifications are the back office, content_posts is marketing.
drop policy if exists "Authenticated users full access" on leads;
drop policy if exists "Admins full access" on leads;
create policy "Admins full access"
on leads for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Authenticated users full access" on expenses;
drop policy if exists "Admins full access" on expenses;
create policy "Admins full access"
on expenses for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Authenticated users full access" on notifications;
drop policy if exists "Admins full access" on notifications;
create policy "Admins full access"
on notifications for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Authenticated users full access" on content_posts;
drop policy if exists "Admins full access" on content_posts;
create policy "Admins full access"
on content_posts for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- ==============================================================================
-- 8. THE TWO WAYS ROUND THE POLICIES
--
-- (a) VIEWS. A view runs as its owner unless told otherwise, so booking_stats
--     would have handed a detailer counts over all 60 bookings no matter what
--     the bookings policies said. security_invoker makes it obey the caller.
--     The admin still sees every booking through it, because their own policy
--     is unrestricted.
--
-- (b) SECURITY DEFINER FUNCTIONS. Every RPC below bypasses RLS by design and
--     was executable by PUBLIC, so a detailer session could have called
--     get_followup_leads() and read the whole lead pipeline. EXECUTE is revoked
--     from public and authenticated. anon and service_role keep it so the n8n
--     workflows carry on working whichever key they use; the dashboard calls
--     none of these from the browser, so nothing in the app breaks.
--
--     Worth knowing: leaving anon in place means these functions are still
--     reachable by anyone holding the public anon key. That is exactly as true
--     today as it was before this migration, so it is not a regression, but it
--     is the next thing to close. The fix is to move n8n onto the service_role
--     key and then drop anon from these grants.
-- ==============================================================================
alter view booking_stats set (security_invoker = true);

revoke execute on function public.get_due_notifications() from public, authenticated;
revoke execute on function public.get_followup_leads(integer, integer, integer, integer) from public, authenticated;
revoke execute on function public.get_lead_for_followup(uuid) from public, authenticated;
revoke execute on function public.convert_lead_to_booking(uuid) from public, authenticated;
revoke execute on function public.upsert_lead_message(text, text, text) from public, authenticated;
revoke execute on function public.save_lead_details(
  text, text, text, text, text, integer, text, text, boolean, text, date, time,
  boolean, boolean, numeric, text, text, text
) from public, authenticated;

grant execute on function public.get_due_notifications() to anon, service_role;
grant execute on function public.get_followup_leads(integer, integer, integer, integer) to anon, service_role;
grant execute on function public.get_lead_for_followup(uuid) to anon, service_role;
grant execute on function public.convert_lead_to_booking(uuid) to anon, service_role;
grant execute on function public.upsert_lead_message(text, text, text) to anon, service_role;
grant execute on function public.save_lead_details(
  text, text, text, text, text, integer, text, text, boolean, text, date, time,
  boolean, boolean, numeric, text, text, text
) to anon, service_role;

-- ==============================================================================
-- 9. REALTIME
-- The portal subscribes to bookings the same way the dashboard does. Realtime
-- applies the policies above, so a detailer only receives events for rows they
-- can already read.
-- ==============================================================================
do $$ begin
  alter publication supabase_realtime add table public.detailer_payouts;
exception when duplicate_object then null;
end $$;

commit;

-- ==============================================================================
-- 10. LINKING A LOGIN FROM THE ADMIN PANEL
-- The admin creates the account in Supabase Auth (that is where a password can
-- be set safely) and then links it here by email. Done as a function because
-- auth.users is not readable from the browser with the anon key, and it should
-- stay that way: this exposes exactly one lookup, by exact email, to admins.
--
-- The two guards are the ones that matter. An admin login must never double as
-- a detailer login, or is_admin() would win every policy and the portal would
-- show that person the whole book. And one login cannot be linked to two
-- detailers, or their job lists would merge.
-- ==============================================================================
create or replace function public.admin_link_detailer_login(p_detailer_id uuid, p_email text)
returns detailers
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_user_id uuid;
  v_email text;
  v_row detailers;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  v_email := lower(trim(p_email));
  if v_email = '' or v_email is null then
    raise exception 'An email address is required' using errcode = '22023';
  end if;

  select u.id into v_user_id from auth.users u where lower(u.email) = v_email;

  if v_user_id is null then
    raise exception 'No login exists for %. Create the user in Supabase Auth first.', v_email
      using errcode = 'P0002';
  end if;

  if exists (select 1 from public.admin_users a where a.user_id = v_user_id) then
    raise exception 'That login is an admin account and cannot also be a detailer'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.detailers d
    where d.auth_user_id = v_user_id and d.id <> p_detailer_id
  ) then
    raise exception 'That login is already linked to another detailer' using errcode = '23505';
  end if;

  update public.detailers
  set auth_user_id = v_user_id, email = v_email
  where id = p_detailer_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'No such detailer' using errcode = 'P0002';
  end if;

  return v_row;
end;
$fn$;

create or replace function public.admin_unlink_detailer_login(p_detailer_id uuid)
returns detailers
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_row detailers;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  update public.detailers
  set auth_user_id = null
  where id = p_detailer_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'No such detailer' using errcode = 'P0002';
  end if;

  return v_row;
end;
$fn$;

revoke execute on function public.admin_link_detailer_login(uuid, text) from public;
revoke execute on function public.admin_unlink_detailer_login(uuid) from public;
grant execute on function public.admin_link_detailer_login(uuid, text) to authenticated;
grant execute on function public.admin_unlink_detailer_login(uuid) to authenticated;
