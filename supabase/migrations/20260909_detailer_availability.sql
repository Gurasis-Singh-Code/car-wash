-- ==============================================================================
-- DETAILER AVAILABILITY
-- A recurring weekly schedule: each detailer sets the hours they work on each
-- day. Purely informational. Nothing reads it to filter, restrict or warn in the
-- Assign Detailer dropdown - assignment behaves exactly as it did before.
--
-- Idempotent: safe to run more than once.
-- Depends on 20260909_detailer_portal.sql for is_admin() and
-- current_active_detailer_id().
-- ==============================================================================

begin;

-- Declared Monday first so that the enum's own sort order is the order the week
-- is read in. `order by day_of_week` then needs no CASE expression, and both
-- apps get Mon-Sun for free.
do $blk$ begin
  create type day_of_week as enum ('mon','tue','wed','thu','fri','sat','sun');
exception when duplicate_object then null;
end $blk$;

-- A day the detailer does not work has NO ROW, rather than a row with a null
-- range or an "available" boolean. That keeps the table to the one meaning it
-- has - "these are the hours I work on this day" - and it is why the portal
-- offers a Clear action per day: clearing deletes the row.
create table if not exists detailer_availability (
  id uuid primary key default gen_random_uuid(),
  detailer_id uuid not null references detailers (id) on delete cascade,
  day_of_week day_of_week not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- At most one row per day per detailer, so the table can hold 7 rows for
  -- someone at the most and a double entry is a database error rather than two
  -- conflicting ranges that the UI would have to pick between.
  constraint detailer_availability_day_unique unique (detailer_id, day_of_week),

  -- Rules out the transposed entry (finishing before starting), which is the
  -- mistake a time picker actually invites. It also rules out a shift crossing
  -- midnight; that is not a thing a detailing round does, and allowing it would
  -- make every range comparison ambiguous.
  constraint detailer_availability_ends_after_start check (end_time > start_time)
);

create index if not exists detailer_availability_detailer_idx
  on detailer_availability (detailer_id, day_of_week);

drop trigger if exists detailer_availability_touch_updated_at on detailer_availability;
create trigger detailer_availability_touch_updated_at
before update on detailer_availability
for each row execute function set_updated_at();

-- ==============================================================================
-- ACCESS
-- Admins read every schedule (the dashboard shows them read-only). A detailer
-- has full control of their own rows and no visibility of anyone else's - the
-- same shape as the rest of the portal's tables.
--
-- WITH CHECK repeats the USING clause deliberately: without it a detailer could
-- INSERT or UPDATE a row carrying someone else's detailer_id, which USING alone
-- does not prevent.
-- ==============================================================================
alter table detailer_availability enable row level security;

drop policy if exists "Admins full access" on detailer_availability;
create policy "Admins full access"
on detailer_availability for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Detailers manage their own hours" on detailer_availability;
create policy "Detailers manage their own hours"
on detailer_availability for all to authenticated
using (detailer_id = public.current_active_detailer_id())
with check (detailer_id = public.current_active_detailer_id());

do $blk$ begin
  alter publication supabase_realtime add table public.detailer_availability;
exception when duplicate_object then null;
end $blk$;

commit;
