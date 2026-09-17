-- Add pet hair removal (+$25) to the website booking RPC. Price stored on the
-- booking includes the add-on, matching how the Instagram flow records it.
-- Signature change: dropped and recreated so PostgREST resolves one function.
drop function if exists public.create_website_booking(text, text, text, text, text, date, time, text, boolean, boolean);

create function public.create_website_booking(
  p_name text,
  p_phone text,
  p_package text,
  p_service_type text,
  p_address text,
  p_date date,
  p_time time,
  p_notes text default null,
  p_has_power boolean default false,
  p_has_water boolean default false,
  p_pet_hair boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_service service_type;
  v_price numeric;
  v_id uuid;
begin
  -- Basic input hygiene
  if p_name is null or length(btrim(p_name)) < 2 or length(p_name) > 120 then
    raise exception 'Please enter your full name.' using errcode = '22023';
  end if;
  if public.phone_digits(p_phone) is null or length(p_phone) > 40 then
    raise exception 'Please enter a valid 10-digit phone number.' using errcode = '22023';
  end if;
  if p_address is null or length(btrim(p_address)) < 3 or length(p_address) > 300 then
    raise exception 'Please tell us where to come.' using errcode = '22023';
  end if;
  if p_date is null or p_date < current_date or p_date > current_date + 120 then
    raise exception 'Please choose a date within the next 120 days.' using errcode = '22023';
  end if;
  if p_time is null or p_time < '09:00' or p_time > '17:00' then
    raise exception 'Please choose a time between 9:00 AM and 5:00 PM.' using errcode = '22023';
  end if;
  if p_notes is not null and length(p_notes) > 1000 then
    raise exception 'Notes are too long.' using errcode = '22023';
  end if;

  -- Map the site's package/type to the dashboard's service enum + price
  case lower(p_package) || '_' || lower(p_service_type)
    when 'gold_interior'     then v_service := 'interior_gold';     v_price := 130;
    when 'gold_full'         then v_service := 'full_gold';         v_price := 160;
    when 'titanium_interior' then v_service := 'interior_titanium'; v_price := 170;
    when 'titanium_full'     then v_service := 'full_titanium';     v_price := 200;
    else raise exception 'Unknown service selection.' using errcode = '22023';
  end case;
  if coalesce(p_pet_hair, false) then
    v_price := v_price + 25;
  end if;

  -- Light abuse guard: max 3 website requests per phone per day
  if (select count(*) from public.bookings
       where source = 'website'
         and created_at > now() - interval '1 day'
         and public.phone_digits(client_no) = public.phone_digits(p_phone)) >= 3 then
    raise exception 'You have already sent several requests today. Please call us instead.' using errcode = '22023';
  end if;

  insert into public.bookings (
    customer_name, client_no, car_type, car_count, service, service_location,
    address, booking_date, booking_time, has_power, has_water, pet_hair, price, notes,
    status, assigned_detailer, source
  ) values (
    btrim(p_name), btrim(p_phone), 'other', 1, v_service, 'mobile',
    btrim(p_address), p_date, p_time, coalesce(p_has_power, false), coalesce(p_has_water, false),
    coalesce(p_pet_hair, false), v_price, nullif(btrim(p_notes), ''),
    'scheduled', 'Unassigned', 'website'
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_website_booking(text, text, text, text, text, date, time, text, boolean, boolean, boolean) from public;
grant execute on function public.create_website_booking(text, text, text, text, text, date, time, text, boolean, boolean, boolean) to anon, authenticated;
