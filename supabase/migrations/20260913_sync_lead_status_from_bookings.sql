-- Keep a lead's stage in step with what actually happened.
--
-- There were two ways a lead became a booking and only one of them told the
-- lead. convert_lead_to_booking() set lead_status = 'converted' and booking_id,
-- but the chatbot's create_booking tool inserts straight into bookings and
-- never touched leads. Every bot booking left its lead stuck at in_progress,
-- and the Leads panel's conversion rate was about half the real figure.
-- convert_lead_to_booking() had in fact never been called: all 23 "converted"
-- leads were set by hand and none had a booking_id.
--
-- Now bookings are the ground truth and the lead's stage is derived from them:
--   any scheduled or completed booking  -> converted, booking_id = the most
--                                          relevant one (upcoming first)
--   only cancelled bookings             -> lost
--   no bookings at all                  -> left alone; the owner's own
--                                          judgement in the dropdown stands
--
-- A lead is matched to a booking by Instagram ID, or failing that by phone
-- number (last ten digits, so +1 / spaces / dashes do not matter). Phone
-- matching is what catches a customer who enquired on Instagram and then was
-- booked by hand from the admin form.

-- ---------------------------------------------------------------------------
-- 1. Phone normalisation
-- ---------------------------------------------------------------------------

create or replace function public.phone_digits(p text)
returns text
language sql immutable
as $fn$
  select case
    when p is null then null
    when length(regexp_replace(p, '\D', '', 'g')) < 10 then null
    else right(regexp_replace(p, '\D', '', 'g'), 10)
  end;
$fn$;

-- ---------------------------------------------------------------------------
-- 2. Recompute one lead from its bookings
-- ---------------------------------------------------------------------------

create or replace function public.sync_lead_from_bookings(p_lead_id uuid)
returns void
language plpgsql
security definer set search_path = public, pg_temp
as $fn$
declare
  v_lead       public.leads;
  v_best       public.bookings;
  v_new_status public.lead_status;
begin
  select * into v_lead from public.leads where id = p_lead_id;
  if not found then
    return;
  end if;

  -- The booking that best represents this lead: an upcoming one over a finished
  -- one over a cancelled one, and the latest within each.
  select b.* into v_best
  from public.bookings b
  where (v_lead.instagram_user_id ~ '^[0-9]{6,}$'
         and b.instagram_user_id = v_lead.instagram_user_id)
     or (public.phone_digits(v_lead.client_no) is not null
         and public.phone_digits(b.client_no) = public.phone_digits(v_lead.client_no))
  order by case b.status when 'scheduled' then 0 when 'completed' then 1 else 2 end,
           b.booking_date desc, b.created_at desc
  limit 1;

  -- No booking anywhere: nothing to derive, do not overrule the owner.
  if v_best.id is null then
    return;
  end if;

  v_new_status := case when v_best.status = 'cancelled' then 'lost' else 'converted' end;

  update public.leads
     set lead_status = v_new_status,
         booking_id  = v_best.id
   where id = p_lead_id
     and (lead_status is distinct from v_new_status or booking_id is distinct from v_best.id);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. Fire it from bookings
-- ---------------------------------------------------------------------------

create or replace function public.bookings_sync_leads()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $fn$
declare
  v_lead_id uuid;
begin
  -- Every lead this booking could belong to, before and after the change, so a
  -- booking moved to a different customer releases the old lead too.
  for v_lead_id in
    select distinct l.id
    from public.leads l
    where (new.instagram_user_id is not null and l.instagram_user_id = new.instagram_user_id)
       or (public.phone_digits(new.client_no) is not null
           and public.phone_digits(l.client_no) = public.phone_digits(new.client_no))
       or (tg_op = 'UPDATE' and old.instagram_user_id is not null
           and l.instagram_user_id = old.instagram_user_id)
       or (tg_op = 'UPDATE' and public.phone_digits(old.client_no) is not null
           and public.phone_digits(l.client_no) = public.phone_digits(old.client_no))
  loop
    perform public.sync_lead_from_bookings(v_lead_id);
  end loop;

  return null;
end;
$fn$;

drop trigger if exists trg_bookings_sync_leads on public.bookings;
create trigger trg_bookings_sync_leads
after insert or update of status, instagram_user_id, client_no on public.bookings
for each row execute function public.bookings_sync_leads();

revoke execute on function public.sync_lead_from_bookings(uuid) from public;
revoke execute on function public.bookings_sync_leads() from public;

-- ---------------------------------------------------------------------------
-- 4. Backfill every existing lead
-- ---------------------------------------------------------------------------

select public.sync_lead_from_bookings(id) from public.leads;
