# Prompt 2 — Backend: Supabase Wiring (Absolute Mobile Car Detailing)

Paste this into Antigravity after Prompt 1 is built. The UI components already exist (`StatCard`, `BookingList`, `BookingForm`) and take data via props/callbacks matching `types/booking.ts`. Your job is to replace every stub with a real, live Supabase connection — no dummy data, no simulated delays.

## Goal
Wire the existing home (`/`) and admin (`/admin`) pages to a real Supabase backend: schema, auth, CRUD, and realtime sync — so data is live from first load, and a booking added in `/admin` appears on `/` within ~1 second with no manual refresh.

## Task 1 — Supabase schema
Run this exact SQL in the Supabase SQL editor. Do not add extra tables.

```sql
create extension if not exists pgcrypto;

create type car_type as enum ('sedan','hatchback','suv','van','mini_truck','other');
create type service_type as enum ('interior_silver','interior_gold','full_silver','full_gold');
create type booking_status as enum ('scheduled','completed','cancelled');

create table bookings (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  client_no text,
  instagram_user_id text,
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

create index idx_bookings_date on bookings (booking_date, booking_time);
create index idx_bookings_status on bookings (status);
create index idx_bookings_instagram on bookings (instagram_user_id);

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

alter table bookings enable row level security;

create policy "Authenticated users full access"
on bookings for all
to authenticated
using (true)
with check (true);

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
```

## Task 2 — Client + data layer
Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Create `lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

Create `lib/bookings.ts` with real, typed CRUD functions matching `types/booking.ts` — no mock arrays, no artificial delays:
- `getBookings(): Promise<Booking[]>`
- `getUpcomingBookings(): Promise<Booking[]>` — status = 'scheduled', ordered by date/time ascending
- `getStats(): Promise<BookingStats>` — single row from `booking_stats` view
- `addBooking(data: Omit<Booking,'id'|'status'>): Promise<Booking>`
- `updateBooking(id: string, data: Partial<Booking>): Promise<Booking>`
- `deleteBooking(id: string): Promise<void>`
- `subscribeToBookings(callback: () => void)` — Supabase Realtime channel on `postgres_changes` for the `bookings` table (insert/update/delete), triggers `callback` so pages can refetch

## Task 3 — Auth
Add Supabase Auth (email/password, single admin user). Create `app/login/page.tsx`. Gate **both** `/` and `/admin` behind a logged-in session with middleware or a layout-level check — home shows customer names and addresses, so it should not be public either. Redirect unauthenticated visits to `/login`.

## Task 4 — Wire the home page (`/`)
Replace the empty-array/`null` defaults with real data:
- On load, call `getStats()` and `getUpcomingBookings()`, feed results into `StatCard` and `BookingList`
- Call `subscribeToBookings()` on mount; on any change, refetch stats + upcoming bookings so the page updates live; unsubscribe on unmount
- Keep the existing empty-state UI for when the live query returns zero rows

## Task 5 — Wire the admin panel (`/admin`)
- Replace `BookingForm`'s stub `onSubmit` with a real call to `addBooking()`; on success show the existing inline success state and clear the form; on failure show an inline error, don't fail silently
- Replace `BookingList`'s stub `onEdit`/`onDelete` with real `updateBooking()` / `deleteBooking()` calls, optimistic UI update, roll back on error
- List should show all bookings (not just scheduled) here, using `getBookings()`

## Constraints
- Do not change any visual/layout code from Prompt 1 — only replace data logic
- Do not seed or hardcode sample bookings
- Do not add Google Maps/Places for the address field

## Acceptance criteria
- A booking added in `/admin` appears on `/` within ~1 second, no manual refresh
- Editing/deleting a booking updates both pages correctly
- An empty Supabase table shows the empty state, not an error or blank screen
- Submitting the form with a missing field or a past date is rejected before hitting Supabase
- Logged-out visits to `/` or `/admin` redirect to `/login`
