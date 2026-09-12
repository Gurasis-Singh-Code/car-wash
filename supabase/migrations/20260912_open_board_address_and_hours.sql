-- Two changes to what detailers see on the open board.
--
-- 1. The full street address, not a coarse area. The owner decided a detailer
--    needs to know exactly where a job is before deciding whether to take it.
--    Customer name and notes stay hidden until claimed - notes carry gate codes.
--
-- 2. Only jobs starting between 09:00 and 17:00 are offered. The chatbot has
--    been told the hours too, but a prompt is a request, not a guarantee: an
--    8 AM booking slipped through, was claimed and confirmed to the customer
--    before anyone at the business saw it. An off-hours booking now stays
--    unassigned until the owner looks at it, and the two-hour unclaimed alert
--    on the dashboard makes sure that happens.
--
-- The return type changes, so this has to be drop-and-create.

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
  address text,
  offered_at timestamptz
)
language sql stable security definer set search_path = public, pg_temp
as $fn$
  select b.id, b.service::text, b.service_location::text, b.car_type::text,
         b.car_count, b.vehicle_make_model, b.booking_date, b.booking_time,
         b.price, b.engine_bay_fee, b.out_of_area_fee, b.pet_hair,
         b.has_power, b.has_water,
         b.address, b.offered_at
  from bookings b
  where b.assigned_detailer_id is null
    and b.status = 'scheduled'
    and b.booking_date >= current_date
    and b.booking_time between '09:00' and '17:00'
    and public.current_active_detailer_id() is not null
  order by b.booking_date asc, b.booking_time asc;
$fn$;

revoke execute on function public.detailer_open_jobs() from public;
grant execute on function public.detailer_open_jobs() to authenticated;
