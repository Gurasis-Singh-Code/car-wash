-- The Titanium package: a tier above Gold.
--
--   Full detailing:  sedan/hatchback $200 | SUV/van/mini truck $230
--   Interior only:   sedan/hatchback $160 | SUV/van/mini truck $190
--
-- Interior adds to Gold: 2-stage deep steam shampoo, interior ceramic coating.
-- Exterior adds to Gold: iron-removal decontamination of wheels and paint,
-- hybrid ceramic sealant on painted surfaces.
--
-- Prerequisite, in its own transaction:
--   alter type service_type add value 'interior_titanium';
--   alter type service_type add value 'full_titanium';
--
-- Prices are not stored anywhere in the database - the chatbot quotes them
-- from its prompt and the admin types them on the form - so this migration is
-- about the two places that enumerate services by name.

-- save_lead_details() validated the service against a hard-coded list, which
-- is exactly the kind of thing that silently rejects a new package. It now
-- checks against the enum, so the next package needs only the ALTER TYPE.
create or replace function public.save_lead_details(
  p_instagram_user_id text, p_customer_name text default null, p_client_no text default null,
  p_email text default null, p_car_type text default null, p_car_count integer default null,
  p_vehicle_make_model text default null, p_service text default null, p_pet_hair boolean default null,
  p_address text default null, p_booking_date date default null, p_booking_time time default null,
  p_has_power boolean default null, p_has_water boolean default null, p_price numeric default null,
  p_notes text default null, p_lead_status text default null, p_service_location text default null
)
returns leads
language plpgsql security definer set search_path = public
as $function$
declare
  v_lead public.leads;
begin
  if p_instagram_user_id is null or p_instagram_user_id = '' then
    raise exception 'instagram_user_id is required';
  end if;

  if p_car_type is not null and p_car_type <> ''
     and p_car_type <> all (enum_range(null::public.car_type)::text[]) then
    raise exception 'invalid car_type: %. Use one of %', p_car_type,
      array_to_string(enum_range(null::public.car_type)::text[], ', ');
  end if;

  if p_service is not null and p_service <> ''
     and p_service <> all (enum_range(null::public.service_type)::text[]) then
    raise exception 'invalid service: %. Use one of %', p_service,
      array_to_string(enum_range(null::public.service_type)::text[], ', ');
  end if;

  if p_service_location is not null and p_service_location <> ''
     and p_service_location not in ('mobile','shop') then
    raise exception 'invalid service_location: %. Use mobile or shop', p_service_location;
  end if;

  insert into public.leads (instagram_user_id, lead_status)
  values (p_instagram_user_id, 'in_progress')
  on conflict (instagram_user_id) do nothing;

  update public.leads set
    customer_name      = coalesce(nullif(p_customer_name, ''), customer_name),
    client_no          = coalesce(nullif(p_client_no, ''), client_no),
    email              = coalesce(nullif(p_email, ''), email),
    car_type           = coalesce(nullif(p_car_type, '')::public.car_type, car_type),
    car_count          = coalesce(p_car_count, car_count),
    vehicle_make_model = coalesce(nullif(p_vehicle_make_model, ''), vehicle_make_model),
    service            = coalesce(nullif(p_service, '')::public.service_type, service),
    service_location   = coalesce(nullif(p_service_location, '')::public.service_location, service_location),
    pet_hair           = coalesce(p_pet_hair, pet_hair),
    address            = coalesce(nullif(p_address, ''), address),
    booking_date       = coalesce(p_booking_date, booking_date),
    booking_time       = coalesce(p_booking_time, booking_time),
    has_power          = coalesce(p_has_power, has_power),
    has_water          = coalesce(p_has_water, has_water),
    price              = coalesce(p_price, price),
    notes              = coalesce(nullif(p_notes, ''), notes),
    lead_status        = coalesce(nullif(p_lead_status, '')::public.lead_status, lead_status)
  where instagram_user_id = p_instagram_user_id
  returning * into v_lead;

  if v_lead.lead_status in ('new','in_progress')
     and v_lead.customer_name is not null
     and v_lead.car_type is not null
     and v_lead.service is not null
     and v_lead.address is not null
     and v_lead.booking_date is not null
     and v_lead.booking_time is not null then
    update public.leads set lead_status = 'details_collected'
    where id = v_lead.id
    returning * into v_lead;
  end if;

  return v_lead;
end $function$;

-- The push notification's service label. Same shape as before, two more rows.
create or replace function public.service_label(p public.service_type)
returns text
language sql immutable
as $fn$
  select case p
    when 'interior_silver'   then 'Interior Silver'
    when 'interior_gold'     then 'Interior Gold'
    when 'interior_titanium' then 'Interior Titanium'
    when 'full_silver'       then 'Full Silver'
    when 'full_gold'         then 'Full Gold'
    when 'full_titanium'     then 'Full Titanium'
    when 'ceramic_tint'      then 'Ceramic Tint'
    when 'nano_ceramic_tint' then 'Nano Ceramic Tint'
    else initcap(replace(p::text, '_', ' '))
  end;
$fn$;

create or replace function public.push_dispatch(p_secret text, p_booking_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $fn$
declare
  v_b     bookings;
  v_body  text;
  v_area  text;
  v_when  text;
  v_subs  jsonb;
begin
  if not public.push_secret_ok(p_secret) then
    return null;
  end if;

  select * into v_b from bookings where id = p_booking_id;
  if v_b.id is null or v_b.assigned_detailer_id is not null or v_b.status <> 'scheduled' then
    return jsonb_build_object('skipped', 'no longer on the board');
  end if;

  v_area := case
    when v_b.service_location = 'shop' or v_b.address like 'In-shop%' then 'At our shop'
    when v_b.address is null or btrim(v_b.address) = '' then 'Area not given'
    when position(',' in v_b.address) > 0 then btrim(substring(v_b.address from position(',' in v_b.address) + 1))
    else 'Area shown on the board'
  end;

  v_when := to_char(v_b.booking_date, 'Dy DD Mon') || ', ' || trim(leading '0' from to_char(v_b.booking_time, 'HH12:MI AM'));

  v_body := public.service_label(v_b.service)
          || ' · ' || (case when v_b.car_count > 1 then v_b.car_count || ' × ' else '' end)
          || (case v_b.car_type
                when 'sedan' then 'Sedan' when 'hatchback' then 'Hatchback' when 'suv' then 'SUV'
                when 'van' then 'Van' when 'mini_truck' then 'Mini truck' else 'Vehicle' end)
          || ' · ' || v_area || E'\n' || v_when;

  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]'::jsonb)
    into v_subs
  from push_subscriptions s
  join detailers d on d.id = s.detailer_id
  where d.status = 'active' and d.auth_user_id is not null;

  return jsonb_build_object(
    'vapid_private_key', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private_key'),
    'payload', jsonb_build_object('title', 'New job up for grabs', 'body', v_body, 'url', '/jobs', 'tag', 'job-' || v_b.id),
    'subscriptions', v_subs
  );
end;
$fn$;
