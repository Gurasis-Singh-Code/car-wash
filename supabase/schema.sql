-- Supabase Schema for Absolute Mobile Car Detailing
-- ==============================================================================
-- 🚀 MIGRATION: RUN THIS BLOCK IF UPGRADING AN EXISTING BOOKINGS TABLE
-- Ensures all metadata (Phone/Mobile No., Instagram User ID, Car Count,
-- Assigned Detailer) has dedicated database columns and cleans legacy address data.
-- ==============================================================================
alter table bookings add column if not exists number text;
alter table bookings add column if not exists client_no text;
alter table bookings add column if not exists instagram_user_id text;
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
  email text,
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
-- REALTIME
-- Both tables must belong to the supabase_realtime publication or the app's
-- postgres_changes subscriptions ("Live Sync") receive no events at all.
-- ==============================================================================
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.leads;
