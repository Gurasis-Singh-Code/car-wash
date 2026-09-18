-- The business narrows to two packages, mobile only, flat pricing.
--
--   Gold:      interior $130 | full $160     (~2.5 h)
--   Titanium:  interior $170 | full $200     (~3-3.5 h)
--   Add-ons:   pet hair +$25, engine bay +$30, out-of-area +$20
--   No tax on top - the quoted price is the price.
--
-- Silver and tint are retired. Their enum values stay: Postgres cannot drop
-- an enum value, and 15 historical rows plus two upcoming Silver bookings
-- (quoted at Silver prices, to be honoured) still carry them. They simply stop
-- being offered anywhere new.
--
-- Vehicle type no longer affects price, so the bot and the form stop asking.
-- The column becomes nullable rather than being filled with a placeholder.
-- Free-text make/model stays, because a detailer still likes to know what is
-- in the driveway.
--
-- service_location stays as a column defaulting to 'mobile' - every booking
-- ever taken was mobile - but nothing offers 'shop' any more.

alter table public.bookings alter column car_type drop not null;

-- Push notification body: package, make/model if known, area, when.
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
    when v_b.address is null or btrim(v_b.address) = '' then 'Area not given'
    when position(',' in v_b.address) > 0 then btrim(substring(v_b.address from position(',' in v_b.address) + 1))
    else 'Area shown on the board'
  end;

  v_when := to_char(v_b.booking_date, 'Dy DD Mon') || ', ' || trim(leading '0' from to_char(v_b.booking_time, 'HH12:MI AM'));

  v_body := public.service_label(v_b.service)
          || case when v_b.car_count > 1 then ' · ' || v_b.car_count || ' vehicles' else '' end
          || case when nullif(btrim(coalesce(v_b.vehicle_make_model, '')), '') is not null
                  then ' · ' || btrim(v_b.vehicle_make_model) else '' end
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
