-- Supabase Schema for Absolute Mobile Car Detailing
-- ==============================================================================
-- 🚀 MIGRATION: RUN THIS BLOCK IF UPGRADING AN EXISTING BOOKINGS TABLE
-- Ensures all metadata (Phone/Mobile No., Instagram User ID, Car Count,
-- Assigned Detailer) has dedicated database columns and cleans legacy address data.
-- ==============================================================================
alter table bookings add column if not exists number text;
alter table bookings add column if not exists client_no text;
alter table bookings add column if not exists instagram_user_id text;
alter table bookings add column if not exists email text;
alter table bookings add column if not exists car_count integer not null default 1;
alter table bookings add column if not exists assigned_detailer text default 'Unassigned';

-- Performance & Query Indexes on dedicated columns
create index if not exists idx_bookings_number on bookings (number);
create index if not exists idx_bookings_instagram on bookings (instagram_user_id);
create index if not exists idx_bookings_assigned_detailer on bookings (assigned_detailer);

-- Backfill dedicated columns from legacy metadata embedded in the address column
-- (must run BEFORE the cleanup step below, or this data is lost permanently)
with extracted as (
  select
    id,
    (regexp_match(address, '<!--meta:([\s\S]*?)-->'))[1]::jsonb as meta
  from bookings
  where address like '%<!--meta:%'
)
update bookings b
set
  client_no = coalesce(b.client_no, e.meta->>'client_no', e.meta->>'number'),
  number = coalesce(b.number, e.meta->>'number', e.meta->>'client_no'),
  instagram_user_id = coalesce(b.instagram_user_id, e.meta->>'instagram_user_id'),
  assigned_detailer = case
    when b.assigned_detailer is null or b.assigned_detailer = 'Unassigned'
      then coalesce(e.meta->>'assigned_detailer', b.assigned_detailer, 'Unassigned')
    else b.assigned_detailer
  end,
  car_count = case
    when b.car_count is null or b.car_count = 1
      then coalesce((e.meta->>'car_count')::int, b.car_count, 1)
    else b.car_count
  end
from extracted e
where b.id = e.id;

-- Clean up the legacy metadata comment now that its data lives in dedicated columns
update bookings
set address = trim(regexp_replace(address, '\n?<!--meta:[\s\S]*?-->', '', 'g'))
where address like '%<!--meta:%';
-- ==============================================================================

create extension if not exists pgcrypto;

-- Custom Enums
create type car_type as enum ('sedan','hatchback','suv','van','mini_truck','other');
create type service_type as enum ('interior_silver','interior_gold','full_silver','full_gold');
create type booking_status as enum ('scheduled','completed','cancelled');
create type lead_status as enum ('new','in_progress','details_collected','confirmed','converted','lost');

-- Bookings Table (Dedicated columns for every data field)
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  number text,                           -- Dedicated Phone/Mobile number column
  client_no text,                        -- Client No. column
  instagram_user_id text,                -- Instagram account ID from the automation
  instagram_username text,               -- Instagram @handle
  email text,                            -- Optional contact email (suggested, never required)
  car_count integer not null default 1,  -- Dedicated vehicle count column
  vehicle_make_model text,
  assigned_detailer text default 'Unassigned', -- Dedicated detailer assignment column
  service service_type not null,
  price numeric,                         -- Quoted price for the job
  pet_hair boolean not null default false,
  address text not null,                 -- Clean physical service address only
  booking_date date not null,
  booking_time time not null,
  car_type car_type not null,
  has_power boolean not null default false,
  has_water boolean not null default false,
  status booking_status not null default 'scheduled',
  notes text,
  source text not null default 'manual', -- 'manual' | automation source (e.g. 'instagram')
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Performance Indexes
create index if not exists idx_bookings_date on bookings (booking_date, booking_time);
create index if not exists idx_bookings_status on bookings (status);
create index if not exists idx_bookings_instagram on bookings (instagram_user_id);
create index if not exists idx_bookings_number on bookings (number);
create index if not exists idx_bookings_assigned_detailer on bookings (assigned_detailer);

-- Updated_at Trigger
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_bookings_updated_at
before update on bookings
for each row execute function set_updated_at();

-- Row Level Security (RLS)
alter table bookings enable row level security;

create policy "Authenticated users full access"
on bookings for all
to authenticated
using (true)
with check (true);

-- Statistics View for instant aggregation
create or replace view booking_stats as
select
  count(*) filter (where status = 'scheduled') as upcoming_count,
  count(*) filter (where booking_date = current_date) as today_count,
  count(*) filter (
    where booking_date >= date_trunc('week', current_date)
    and booking_date < date_trunc('week', current_date) + interval '7 days'
  ) as week_count,
  count(*) filter (where status = 'completed') as completed_count
from bookings;

-- ==============================================================================
-- LEADS TABLE
-- Inbound Instagram DM enquiries captured by the n8n automation. A lead is
-- created on first contact (often with nothing but an instagram_user_id) and is
-- progressively enriched as the conversation collects details. When it turns
-- into a real appointment, booking_id points at the resulting bookings row.
-- ==============================================================================
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  instagram_user_id text not null unique,  -- Upsert key for the automation
  instagram_username text,
  customer_name text,
  client_no text,
  email text,
  car_type car_type,
  car_count integer default 1,
  vehicle_make_model text,
  service service_type,
  pet_hair boolean not null default false,
  address text,
  booking_date date,
  booking_time time,
  has_power boolean,
  has_water boolean,
  price numeric,
  notes text,
  last_message text,                       -- Most recent inbound DM body
  message_count integer not null default 0,
  lead_status lead_status not null default 'new',
  booking_id uuid references bookings (id),-- Set once the lead converts
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists leads_lead_status_idx on leads (lead_status);
create index if not exists leads_last_message_at_idx on leads (last_message_at desc);

create trigger leads_touch_updated_at
before update on leads
for each row execute function set_updated_at();

alter table leads enable row level security;

create policy "Authenticated users full access"
on leads for all
to authenticated
using (true)
with check (true);

-- ==============================================================================
-- NOTIFICATIONS
-- Audit trail for the scheduled reminders / follow-ups workflow. Every attempt
-- is recorded, including the ones that could NOT be delivered, so those become
-- a manual worklist rather than a silent failure.
--   sent           - the Instagram DM went out
--   skipped_window - outside Meta's 24h messaging window, or no numeric IGSID
--   failed         - Instagram rejected the send
-- ==============================================================================
create type notification_type as enum ('booking_reminder','post_service_followup','lead_followup');
create type notification_status as enum ('sent','skipped_window','failed','skipped');

-- Exactly one of booking_id / lead_id is set: booking reminders and post-service
-- asks point at a booking, AI lead follow-ups point at a lead.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings (id) on delete cascade,
  lead_id uuid references leads (id) on delete cascade,
  instagram_user_id text,
  type notification_type not null,
  channel text not null default 'instagram_dm',
  status notification_status not null default 'sent',
  message text,
  error text,                              -- rejection reason, or why it was skipped
  hours_since_last_message numeric,
  created_at timestamptz not null default now()
);

create index if not exists notifications_booking_type_idx on notifications (booking_id, type);
create index if not exists notifications_lead_type_idx on notifications (lead_id, type);
create index if not exists notifications_created_at_idx on notifications (created_at desc);

-- Only ONE successful send per booking per type. skipped/failed rows may repeat
-- so a later run can retry once the customer re-opens the messaging window.
create unique index if not exists notifications_sent_once
  on notifications (booking_id, type) where status = 'sent';

alter table notifications enable row level security;

create policy "Authenticated users full access"
on notifications for all
to authenticated
using (true)
with check (true);

-- Everything due to send right now, already de-duplicated against notifications,
-- with hours since the customer's last inbound DM so the workflow can tell
-- whether Instagram's 24h messaging window is still open.
-- Source: supabase migration add_notifications_table_and_due_queue.
create or replace function get_due_notifications()
returns table (
  booking_id uuid, notification_type text, instagram_user_id text,
  instagram_username text, customer_name text, booking_date date,
  booking_time time, address text, service text, car_count integer,
  has_power boolean, has_water boolean, price numeric,
  last_message_at timestamptz, hours_since_last_message numeric
)
language sql stable security definer set search_path = public
as $$
  with candidates as (
    select b.id as booking_id, 'booking_reminder'::text as notification_type,
           b.instagram_user_id, b.instagram_username, b.customer_name,
           b.booking_date, b.booking_time, b.address, b.service::text as service,
           b.car_count, b.has_power, b.has_water, b.price
    from bookings b
    where b.status = 'scheduled'
      and b.booking_date = current_date + 1
      and coalesce(b.instagram_user_id, '') <> ''
    union all
    select b.id, 'post_service_followup'::text,
           b.instagram_user_id, b.instagram_username, b.customer_name,
           b.booking_date, b.booking_time, b.address, b.service::text,
           b.car_count, b.has_power, b.has_water, b.price
    from bookings b
    where b.status = 'completed'
      and b.booking_date between current_date - 3 and current_date - 1
      and coalesce(b.instagram_user_id, '') <> ''
  )
  select c.booking_id, c.notification_type, c.instagram_user_id, c.instagram_username,
         c.customer_name, c.booking_date, c.booking_time, c.address, c.service,
         c.car_count, c.has_power, c.has_water, c.price,
         l.last_message_at,
         case when l.last_message_at is null then null
              else round(extract(epoch from (now() - l.last_message_at)) / 3600.0, 2)
         end as hours_since_last_message
  from candidates c
  left join leads l on l.instagram_user_id = c.instagram_user_id
  where not exists (
    select 1 from notifications n
    where n.booking_id = c.booking_id
      and n.type::text = c.notification_type
      and n.status = 'sent'
  );
$$;

-- ==============================================================================
-- LEAD FOLLOW-UPS
-- Backs the "Absolute AI lead follow-ups" n8n workflow. Follow-ups are logged in
-- the same notifications table as booking reminders, but point at a lead rather
-- than a booking, so notifications.lead_id is nullable alongside booking_id.
--
-- Statuses used here:
--   sent    - the AI-written DM was delivered
--   failed  - Instagram rejected it (often a missing HUMAN_AGENT permission)
--   skipped - deliberately not sent. The reason is in the error column, and
--             covers all of: dry run held it back, the assistant judged the
--             lead should not be chased, a guard blocked the wording, or the
--             lead is past the 7 day window Instagram allows.
-- ==============================================================================

-- Cold leads that are due a follow-up. Excludes anyone converted or lost,
-- anyone who already has a booking, anyone without a real numeric Instagram
-- ID, anyone followed up too many times, and anyone followed up too recently.
-- Only status = 'sent' counts toward the caps, so a skipped draft never burns
-- a lead's follow-up allowance. Ordered coldest-first.
-- Source: supabase migration add_lead_followup_queue.
create or replace function get_followup_leads(
  min_hours_quiet integer default 48,
  max_days_quiet integer default 30,
  max_followups integer default 2,
  min_days_between integer default 4
)
returns table (
  lead_id uuid, instagram_user_id text, instagram_username text,
  customer_name text, lead_status text, service text, car_type text,
  car_count integer, vehicle_make_model text, address text,
  booking_date date, booking_time time, price numeric, notes text,
  last_message text, message_count integer, hours_quiet numeric,
  days_quiet numeric, followups_sent bigint, last_followup_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  with stats as (
    select n.lead_id,
           count(*) filter (where n.status = 'sent') as sent_count,
           max(n.created_at) filter (where n.status = 'sent') as last_sent
    from notifications n
    where n.lead_id is not null
      and n.type::text = 'lead_followup'
    group by n.lead_id
  )
  select l.id, l.instagram_user_id, l.instagram_username, l.customer_name,
         l.lead_status::text, l.service::text, l.car_type::text, l.car_count,
         l.vehicle_make_model, l.address, l.booking_date, l.booking_time,
         l.price, l.notes, l.last_message, l.message_count,
         round(extract(epoch from (now() - l.last_message_at)) / 3600.0, 2),
         round(extract(epoch from (now() - l.last_message_at)) / 86400.0, 2),
         coalesce(s.sent_count, 0), s.last_sent
  from leads l
  left join stats s on s.lead_id = l.id
  where l.lead_status in ('new', 'in_progress', 'details_collected', 'confirmed')
    and l.booking_id is null
    and l.instagram_user_id ~ '^[0-9]{6,}$'
    and l.last_message_at <= now() - make_interval(hours => min_hours_quiet)
    and l.last_message_at >= now() - make_interval(days => max_days_quiet)
    and coalesce(s.sent_count, 0) < max_followups
    and (s.last_sent is null or s.last_sent <= now() - make_interval(days => min_days_between))
  order by l.last_message_at asc;
$$;

-- ==============================================================================
-- REALTIME
-- Both tables must belong to the supabase_realtime publication or the app's
-- postgres_changes subscriptions ("Live Sync") receive no events at all.
-- ==============================================================================
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.leads;
