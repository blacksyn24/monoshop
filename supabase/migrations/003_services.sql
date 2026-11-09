-- Produits de type "service" (ex : présentation PowerPoint de soutenance) + infos complémentaires sur les commandes
alter table public.products add column kind text not null default 'physique' check (kind in ('physique', 'service'));
alter table public.orders add column extra jsonb not null default '{}';

drop function public.place_order(text, int, text, text, text, text, text);

create function public.place_order(
  p_slug text, p_offer int, p_name text, p_phone text, p_city text,
  p_address text default '', p_note text default '', p_extra jsonb default '{}'
) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_product public.products;
  v_offer jsonb;
  v_ip text;
  v_order public.orders;
  v_extra jsonb := '{}';
  v_key text;
  v_name text := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 80);
  v_phone text := left(btrim(coalesce(p_phone, '')), 20);
  v_city text := left(btrim(regexp_replace(coalesce(p_city, ''), '\s+', ' ', 'g')), 60);
begin
  select * into v_product from public.products where slug = p_slug and active;
  if not found then raise exception 'produit_introuvable'; end if;

  v_offer := v_product.offers -> coalesce(p_offer, 0);
  if v_offer is null then v_offer := v_product.offers -> 0; end if;
  if v_offer is null then raise exception 'offre_invalide'; end if;

  if v_name = '' or v_city = '' or length(regexp_replace(v_phone, '\D', '', 'g')) < 8 then
    raise exception 'champs_invalides';
  end if;

  -- On ne garde que les champs connus, en texte court
  foreach v_key in array array['ecole', 'niveau', 'theme', 'soutenance'] loop
    if jsonb_typeof(p_extra -> v_key) = 'string' and btrim(p_extra ->> v_key) <> '' then
      v_extra := v_extra || jsonb_build_object(v_key, left(btrim(p_extra ->> v_key), 200));
    end if;
  end loop;
  if v_extra ? 'soutenance' and (v_extra ->> 'soutenance') !~ '^\d{4}-\d{2}-\d{2}$' then
    v_extra := v_extra - 'soutenance';
  end if;

  v_ip := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1);
  if v_ip <> '' and (select count(*) from public.orders where ip = v_ip and created_at > now() - interval '10 minutes') >= 6 then
    raise exception 'trop_de_commandes';
  end if;

  insert into public.orders (product_id, product_name, offer_label, quantity, total,
                             customer_name, phone, city, address, note, ip, extra)
  values (v_product.id, v_product.name, v_offer ->> 'label', greatest(1, (v_offer ->> 'qty')::int),
          (v_offer ->> 'price')::int, v_name, v_phone, v_city,
          left(btrim(coalesce(p_address, '')), 160), left(btrim(coalesce(p_note, '')), 300), nullif(v_ip, ''), v_extra)
  returning * into v_order;

  return json_build_object('id', v_order.id, 'token', v_order.public_token);
end;
$$;
grant execute on function public.place_order(text, int, text, text, text, text, text, jsonb) to anon, authenticated;

create or replace function public.order_summary(p_id bigint, p_token uuid) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'id', o.id, 'first_name', split_part(o.customer_name, ' ', 1), 'phone', o.phone,
    'product_name', o.product_name, 'offer_label', o.offer_label, 'total', o.total,
    'accent', coalesce(p.accent, '#16a34a'), 'kind', coalesce(p.kind, 'physique'))
  from public.orders o left join public.products p on p.id = o.product_id
  where o.id = p_id and o.public_token = p_token;
$$;
