-- Lecture des secrets du coffre (Vault) par la fonction d'envoi d'email uniquement (rôle service_role)
create or replace function public.app_secret(p_name text) returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1;
$$;
revoke execute on function public.app_secret(text) from public, anon, authenticated;
grant execute on function public.app_secret(text) to service_role;
