-- Stop the confirmation queue re-logging the same booking every two minutes.
--
-- get_pending_confirmations() only excluded bookings with a *sent* notification.
-- A booking outside Meta's 24-hour messaging window was logged as skipped_window
-- and then stayed in the queue, so the n8n poll logged it again on every tick.
-- Eight bookings produced 6,780 rows in 33 hours before this was caught. No DMs
-- were sent - a skip never reaches Instagram - but the eight real "confirm this
-- customer by hand" alerts were buried under the duplicates.
--
-- Now any non-sent outcome (skipped_window or failed) blocks the booking until
-- the customer messages again. That is the only event that can reopen the
-- window, so it is the only event worth re-checking on.

create or replace function public.get_pending_confirmations()
returns table (
  booking_id uuid, instagram_user_id text, instagram_username text, customer_name text,
  detailer_name text, booking_date date, booking_time time, address text, service text,
  service_location text, car_count integer, price numeric, engine_bay_fee numeric,
  out_of_area_fee numeric, last_message_at timestamptz, hours_since_last_message numeric
)
language sql stable security definer set search_path = public, pg_temp
as $fn$
  select b.id, b.instagram_user_id, b.instagram_username, b.customer_name,
         b.assigned_detailer, b.booking_date, b.booking_time, b.address,
         b.service::text, b.service_location::text, b.car_count,
         b.price, b.engine_bay_fee, b.out_of_area_fee,
         l.last_message_at,
         case when l.last_message_at is null then null
              else round(extract(epoch from (now() - l.last_message_at)) / 3600.0, 2)
         end
  from bookings b
  left join leads l on l.instagram_user_id = b.instagram_user_id
  where b.assigned_detailer_id is not null
    and b.assignment_status = 'accepted'
    and b.status = 'scheduled'
    and b.instagram_user_id ~ '^[0-9]{6,}$'
    -- Confirmed once, never again.
    and not exists (
      select 1 from notifications n
      where n.booking_id = b.id and n.type = 'booking_confirmed' and n.status = 'sent'
    )
    -- Skipped or failed since the customer last spoke: nothing has changed, do not retry.
    and not exists (
      select 1 from notifications n
      where n.booking_id = b.id and n.type = 'booking_confirmed'
        and n.status in ('skipped_window', 'failed')
        and n.created_at >= coalesce(l.last_message_at, '-infinity'::timestamptz)
    )
  order by b.assignment_responded_at asc nulls last;
$fn$;
