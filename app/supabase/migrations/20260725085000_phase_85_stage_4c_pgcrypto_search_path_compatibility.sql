-- Phase 85 Stage 4C: keep hashing RPCs compatible with Supabase installations
-- that install pgcrypto in the extensions schema while their locked search path
-- resolves only public functions.

create or replace function public.digest(
  p_data text,
  p_type text
)
returns bytea
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select extensions.digest(p_data, p_type)
$$;

revoke all on function public.digest(text, text) from public, anon, authenticated;
grant execute on function public.digest(text, text) to service_role;

create or replace function public.hmac(
  p_data text,
  p_key text,
  p_type text
)
returns bytea
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select extensions.hmac(p_data, p_key, p_type)
$$;

revoke all on function public.hmac(text, text, text) from public, anon, authenticated;
grant execute on function public.hmac(text, text, text) to service_role;
