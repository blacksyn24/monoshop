-- Un seul prix par produit, le client choisit la quantité ; plus de prix barré ; prix sans limite.

alter table public.products add column if not exists price bigint not null default 0;
update public.products
   set price = round((offers -> 0 ->> 'price')::numeric / greatest(coalesce((offers -> 0 ->> 'qty')::int, 1), 1))
 where price = 0 and jsonb_array_length(offers) > 0;
update public.products set compare_price = null;

alter table public.orders alter column total type bigint;
alter table public.orders add column if not exists unit_price bigint;

drop function if exists public.place_order(text, int, text, text, text, text, text, jsonb);

create function public.place_order(
  p_slug text, p_name text, p_phone text, p_city text,
  p_address text default '', p_note text default '', p_extra jsonb default '{}',
  p_qty int default 1, p_offer int default null
) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_product public.products;
  v_unit bigint;
  v_qty int := least(20, greatest(1, coalesce(p_qty, 1)));
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

  -- Prix unitaire calculé par la base (le client ne peut pas le modifier)
  v_unit := v_product.price;
  if coalesce(v_unit, 0) <= 0 and jsonb_array_length(v_product.offers) > 0 then
    v_unit := round((v_product.offers -> 0 ->> 'price')::numeric / greatest(coalesce((v_product.offers -> 0 ->> 'qty')::int, 1), 1));
  end if;
  if coalesce(v_unit, 0) <= 0 then raise exception 'prix_invalide'; end if;

  if v_name = '' or v_city = '' or length(regexp_replace(v_phone, '\D', '', 'g')) < 8 then
    raise exception 'champs_invalides';
  end if;

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

  insert into public.orders (product_id, product_name, offer_label, quantity, unit_price, total,
                             customer_name, phone, city, address, note, ip, extra)
  values (v_product.id, v_product.name, 'Quantité : ' || v_qty, v_qty, v_unit, v_unit * v_qty,
          v_name, v_phone, v_city,
          left(btrim(coalesce(p_address, '')), 160), left(btrim(coalesce(p_note, '')), 300), nullif(v_ip, ''), v_extra)
  returning * into v_order;

  return json_build_object('id', v_order.id, 'token', v_order.public_token);
end;
$$;
grant execute on function public.place_order(text, text, text, text, text, text, jsonb, int, int) to anon, authenticated;
