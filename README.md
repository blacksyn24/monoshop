# Monoshop — sites monoproduit (paiement à la livraison) + dashboard

100 % gratuit : **Cloudflare Pages** (site) + **Supabase** (base de données, comptes, photos).

| Page | Adresse |
|---|---|
| Accueil / liste des produits | `/` |
| Page produit | `/p/<adresse-du-produit>` |
| Remerciement après commande | `/merci` |
| Dashboard (commandes, produits, paramètres) | `/admin/` |

## Mise en ligne sur Cloudflare Pages
- Framework preset : **None**
- Build command : *(vide)*
- Build output directory : **`public`**

## Base de données
- Projet Supabase : `vijmvynnantcsevwqswr` (clés publiques dans `public/assets/config.js`)
- Schéma : `supabase/migrations/`
- Sécurité : les visiteurs peuvent seulement lire les produits actifs et passer commande (prix calculé par la base).
  Seul le compte administrateur voit et modifie les commandes.
- Le **premier compte créé** sur `/admin/` devient l'administrateur.

## Base toujours active
`.github/workflows/keepalive.yml` interroge la base chaque jour pour éviter la mise en pause du plan gratuit Supabase (pause après 7 jours sans activité).
