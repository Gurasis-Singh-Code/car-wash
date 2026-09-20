-- Pet hair removal is +$25 to the customer. $10 of that is Absolute's, $15
-- stays with the detailer. Engine bay and out-of-area remain entirely the
-- detailer's.
--
-- Kept as its own column rather than folded into fee_amount, so the detailer
-- sees "$37 booking fee + $10 pet hair" and not an unexplained $47.
--
-- pet_hair is a single boolean on the booking, so this is $10 per booking
-- with pet hair, not per vehicle. If two cars both need it, the customer is
-- charged $50 but the fee is still $10 - the data cannot say which cars.

alter table public.booking_fees
  add column if not exists pet_hair_fee numeric(10,2) not null default 0;

create or replace function public.sync_booking_fee()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_total numeric;
  v_pet   numeric;
begin
  if new.status = 'completed' and old.status is distinct from 'completed'
     and new.assigned_detailer_id is not null then
    v_total := coalesce(new.price, 0) + coalesce(new.engine_bay_fee, 0) + coalesce(new.out_of_area_fee, 0);
    v_pet   := case when new.pet_hair then 10 else 0 end;
    insert into public.booking_fees
      (booking_id, detailer_id, service, customer_total, fee_amount, pet_hair_fee, completed_on, week_start)
    values
      (new.id, new.assigned_detailer_id, new.service, v_total,
       public.booking_fee_for(new.service, new.price) + v_pet, v_pet,
       current_date, date_trunc('week', current_date)::date)
    on conflict (booking_id) do nothing;
  end if;

  if old.status = 'completed' and new.status is distinct from 'completed' then
    delete from public.booking_fees where booking_id = new.id and status = 'owed';
  end if;

  return null;
end;
$fn$;
