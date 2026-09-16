-- Lock down SECURITY DEFINER functions that were callable by the anonymous role.
-- n8n authenticates as service_role (which keeps EXECUTE on everything), and the
-- admin panel / detailer portal call as authenticated. Only create_website_booking
-- and the secret-gated push_* functions remain callable by anon.

-- n8n-only functions: service_role keeps EXECUTE; remove from anon
revoke execute on function public.upsert_lead_message(text, text, text) from anon;
revoke execute on function public.save_lead_details(text,text,text,text,text,integer,text,text,boolean,text,date,time,boolean,boolean,numeric,text,text,text) from anon;
revoke execute on function public.get_pending_confirmations() from anon;
revoke execute on function public.get_due_notifications() from anon;
revoke execute on function public.get_followup_leads(integer,integer,integer,integer) from anon;
revoke execute on function public.get_lead_for_followup(uuid) from anon;
revoke execute on function public.get_unclaimed_jobs(integer) from anon;
revoke execute on function public.convert_lead_to_booking(uuid) from anon;
revoke execute on function public.sync_lead_from_bookings(uuid) from anon;

-- signed-in-only functions (admin panel / detailer portal): keep authenticated, remove anon
revoke execute on function public.admin_link_detailer_login(uuid, text) from anon;
revoke execute on function public.admin_unlink_detailer_login(uuid) from anon;
revoke execute on function public.detailer_open_jobs() from anon;
revoke execute on function public.detailer_claim_booking(uuid) from anon;
revoke execute on function public.detailer_accept_booking(uuid) from anon;
revoke execute on function public.detailer_decline_booking(uuid) from anon;
revoke execute on function public.detailer_complete_booking(uuid) from anon;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.current_detailer_id() from anon;
revoke execute on function public.current_active_detailer_id() from anon;
