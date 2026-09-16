-- The detailer portal's /api/push/new-job route now calls these with the
-- service role key (server-only), so the anonymous role no longer needs them.
-- push_dispatch and push_report also carried a grant to PUBLIC (every role),
-- which an anon-only revoke does not remove. service_role and authenticated
-- keep their explicit grants. After this, create_website_booking is the only
-- SECURITY DEFINER function anon can execute.
revoke execute on function public.push_dispatch(text, uuid) from public, anon;
revoke execute on function public.push_report(text, uuid, text, integer, integer, uuid[], text) from public, anon;
revoke execute on function public.push_secret_ok(text) from anon;
