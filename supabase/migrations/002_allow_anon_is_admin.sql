-- is_admin() est utilisée dans la règle de lecture des produits : les visiteurs doivent pouvoir l'appeler (elle renvoie false pour eux)
grant execute on function public.is_admin() to anon;
