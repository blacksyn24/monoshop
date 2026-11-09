-- Email à chaque nouvelle commande : la base appelle la fonction "notify-order" (qui envoie via Resend)
alter table public.orders add column if not exists notified_at timestamptz;
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_order() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://vijmvynnantcsevwqswr.supabase.co/functions/v1/notify-order',
    body := jsonb_build_object('id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
exception when others then
  return new; -- un problème d'email ne doit jamais bloquer une commande
end;
$$;
revoke execute on function public.notify_new_order() from public, anon, authenticated;

create trigger orders_notify_email after insert on public.orders
  for each row execute function public.notify_new_order();
