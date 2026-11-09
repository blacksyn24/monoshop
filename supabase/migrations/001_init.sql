-- Monoshop : schéma Supabase (produits, commandes, paramètres, admins, photos)

create table public.products (
  id bigint generated always as identity primary key,
  slug text unique not null check (slug ~ '^[a-z0-9-]{1,60}$'),
  name text not null,
  active boolean not null default true,
  accent text not null default '#ff5a1f',
  headline text not null default '',
  subheadline text not null default '',
  description text not null default '',
  benefits jsonb not null default '[]',
  faq jsonb not null default '[]',
  offers jsonb not null default '[]',
  compare_price integer,
  images jsonb not null default '[]',
  video_url text not null default '',
  created_at timestamptz not null default now()
);

create table public.orders (
  id bigint generated always as identity primary key,
  product_id bigint references public.products(id) on delete set null,
  product_name text not null,
  offer_label text not null,
  quantity integer not null,
  total integer not null,
  customer_name text not null,
  phone text not null,
  city text not null,
  address text not null default '',
  note text not null default '',
  status text not null default 'nouvelle'
    check (status in ('nouvelle','injoignable','confirmee','expediee','livree','retour','annulee')),
  public_token uuid not null default gen_random_uuid(),
  ip text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_created_idx on public.orders (created_at desc);
create index orders_product_idx on public.orders (product_id);
create index orders_ip_idx on public.orders (ip, created_at);

create table public.settings (
  key text primary key,
  value text not null default ''
);

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- Fonctions ----------
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- Le premier compte qui se connecte devient l'administrateur (une seule fois)
create function public.claim_admin() returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return false; end if;
  if not exists (select 1 from public.admins) then
    insert into public.admins (user_id) values (auth.uid());
  end if;
  return exists (select 1 from public.admins where user_id = auth.uid());
end;
$$;

-- Passage de commande : le prix est calculé côté serveur à partir de l'offre choisie
create function public.place_order(
  p_slug text, p_offer int, p_name text, p_phone text, p_city text,
  p_address text default '', p_note text default ''
) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_product public.products;
  v_offer jsonb;
  v_ip text;
  v_order public.orders;
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

  v_ip := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1);
  if v_ip <> '' and (select count(*) from public.orders where ip = v_ip and created_at > now() - interval '10 minutes') >= 6 then
    raise exception 'trop_de_commandes';
  end if;

  insert into public.orders (product_id, product_name, offer_label, quantity, total,
                             customer_name, phone, city, address, note, ip)
  values (v_product.id, v_product.name, v_offer ->> 'label', greatest(1, (v_offer ->> 'qty')::int),
          (v_offer ->> 'price')::int, v_name, v_phone, v_city,
          left(btrim(coalesce(p_address, '')), 160), left(btrim(coalesce(p_note, '')), 300), nullif(v_ip, ''))
  returning * into v_order;

  return json_build_object('id', v_order.id, 'token', v_order.public_token);
end;
$$;

-- Récapitulatif pour la page "Merci" (protégé par le jeton secret de la commande)
create function public.order_summary(p_id bigint, p_token uuid) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'id', o.id, 'first_name', split_part(o.customer_name, ' ', 1), 'phone', o.phone,
    'product_name', o.product_name, 'offer_label', o.offer_label, 'total', o.total,
    'accent', coalesce(p.accent, '#16a34a'))
  from public.orders o left join public.products p on p.id = o.product_id
  where o.id = p_id and o.public_token = p_token;
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.claim_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.claim_admin() to authenticated;
grant execute on function public.place_order(text, int, text, text, text, text, text) to anon, authenticated;
grant execute on function public.order_summary(bigint, uuid) to anon, authenticated;

-- ---------- Sécurité (RLS) ----------
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.settings enable row level security;
alter table public.admins enable row level security;

create policy "produits visibles" on public.products for select to anon, authenticated
  using (active or (select public.is_admin()));
create policy "produits admin insert" on public.products for insert to authenticated with check ((select public.is_admin()));
create policy "produits admin update" on public.products for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "produits admin delete" on public.products for delete to authenticated using ((select public.is_admin()));

create policy "commandes admin select" on public.orders for select to authenticated using ((select public.is_admin()));
create policy "commandes admin update" on public.orders for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "commandes admin delete" on public.orders for delete to authenticated using ((select public.is_admin()));

create policy "parametres lecture" on public.settings for select to anon, authenticated using (true);
create policy "parametres admin insert" on public.settings for insert to authenticated with check ((select public.is_admin()));
create policy "parametres admin update" on public.settings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "admin se voit" on public.admins for select to authenticated using (user_id = (select auth.uid()));

-- ---------- Photos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "photos admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "photos admin update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
create policy "photos admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
create policy "photos admin select" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
