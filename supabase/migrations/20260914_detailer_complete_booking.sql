-- Let a detailer close out their own job from the portal.
--
-- Until now only the admin could mark a booking completed, so every finished
-- job waited for someone in the office to notice. The detailer standing at the
-- car is the one who knows it is done.
--
-- Guarded three ways, all in the database so a phone cannot bypass them:
--   - the caller must be the active detailer the job is assigned to, and must
--     have accepted it (a pending job is not theirs to close);
--   - the booking must still be scheduled - completed and cancelled are final;
--   - the job's start time must have passed, in Toronto time. A fat-fingered
--     "done" on tomorrow's booking is the obvious mistake, and this is what
--     stops it. The start time rather than an estimated finish: the detailer
--     knows when they are done, the check only has to stop the absurd case.

create or replace function public.detailer_complete_booking(p_booking_id uuid)
returns bookings
language plpgsql
security definer set search_path = public, pg_temp
as $fn$
declare
  v_detailer uuid;
  v_row      bookings;
  v_starts   timestamptz;
begin
  v_detailer := public.current_active_detailer_id();
  if v_detailer is null then
    raise exception 'No active detailer for this account' using errcode = '42501';
  end if;

  select * into v_row from bookings where id = p_booking_id;
  if v_row.id is null or v_row.assigned_detailer_id is distinct from v_detailer then
    raise exception 'That job is not assigned to you' using errcode = '42501';
  end if;
  if v_row.assignment_status is distinct from 'accepted' then
    raise exception 'Accept the job before marking it done' using errcode = '42501';
  end if;
  if v_row.status <> 'scheduled' then
    raise exception 'That job is already closed' using errcode = '55006';
  end if;

  v_starts := (v_row.booking_date + v_row.booking_time) at time zone 'America/Toronto';
  if v_starts > now() then
    raise exception 'This job has not started yet' using errcode = '55006';
  end if;

  update bookings
     set status = 'completed'
   where id = p_booking_id
     and status = 'scheduled'
  returning * into v_row;

  return v_row;
end;
$fn$;

revoke execute on function public.detailer_complete_booking(uuid) from public;
grant execute on function public.detailer_complete_booking(uuid) to authenticated;
