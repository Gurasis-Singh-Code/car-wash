-- Supabase Schema for Absolute Mobile Car Detailing
-- ==============================================================================
-- 🚀 MIGRATION: RUN THIS BLOCK IF YOU ALREADY CREATED THE BOOKINGS TABLE:
-- ==============================================================================
alter table bookings add column if not exists client_no text;
alter table bookings add column if not exists car_count integer not null default 1;
alter table bookings add column if not exists assigned_detailer text default 'Unassigned';
-- ==============================================================================

create extension if not exists pgcrypto;

-- Custom Enums
create type car_type as enum ('sedan','hatchback','suv','van','mini_truck','other');
create type service_type as enum ('interior','full','interior_silver','interior_gold','full_silver','full_gold');
create type booking_status as enum ('scheduled','completed','cancelled');

-- Bookings Table
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  client_no text,
  car_count integer not null default 1,
  assigned_detailer text default 'Unassigned',
  service service_type not null,
  address text not null,
  booking_date date not null,
  booking_time time not null,
  car_type car_type not null,
  has_power boolean not null default false,
  has_water boolean not null default false,
  status booking_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Performance Indexes
create index idx_bookings_date on bookings (booking_date, booking_time);
create index idx_bookings_status on bookings (status);

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
