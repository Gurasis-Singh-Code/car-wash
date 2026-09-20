-- Two fixes to booking fees, from walking the process end to end.
--
-- 1. The week a fee lands in was decided by current_date, which is the
--    server's date - UTC. A job marked done at 9 PM on a Sunday in Brampton
--    is already Monday in UTC, so it fell into the following week's invoice.
--    Now it is the Brampton date.
--
-- 2. Fees are due 7 days after the week ends. The week ends Sunday
--    (week_start + 6), so due_on = week_start + 13. Stored as a generated
--    column so nothing can drift from it, and both apps read the same date.

alter table public.booking_fees
  add column if not exists due_on date generated always as (week_start + 13) stored;

create or replace function public.sync_booking_fee()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_total numeric;
  v_pet   numeric;
  v_today date;
begin
  if new.status = 'completed' and old.status is distinct from 'completed'
     and new.assigned_detailer_id is not null then
    v_today := (now() at time zone 'America/Toronto')::date;
    v_total := coalesce(new.price, 0) + coalesce(new.engine_bay_fee, 0) + coalesce(new.out_of_area_fee, 0);
    v_pet   := case when new.pet_hair then 10 else 0 end;
    insert into public.booking_fees
      (booking_id, detailer_id, service, customer_total, fee_amount, pet_hair_fee, completed_on, week_start)
    values
      (new.id, new.assigned_detailer_id, new.service, v_total,
       public.booking_fee_for(new.service, new.price) + v_pet, v_pet,
       v_today, date_trunc('week', v_today)::date)
    on conflict (booking_id) do nothing;
  end if;

  if old.status = 'completed' and new.status is distinct from 'completed' then
    delete from public.booking_fees where booking_id = new.id and status = 'owed';
  end if;

  return null;
end;
$fn$;
