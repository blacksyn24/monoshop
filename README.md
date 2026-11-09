# Monoshop — sites monoproduit + dashboard + email

- Pages produit : `/p/<adresse-du-produit>` (paiement à la livraison)
- Dashboard : `/admin` (mot de passe = `ADMIN_PASSWORD`)
- Email à chaque commande via Resend (`RESEND_API_KEY`, `ORDER_EMAIL`)

## Variables d'environnement
| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Base Postgres (fournie par Render) |
| `ADMIN_PASSWORD` | Mot de passe du dashboard |
| `SESSION_SECRET` | Généré automatiquement par Render |
| `RESEND_API_KEY` | Clé API Resend (resend.com) |
| `ORDER_EMAIL` | Email qui reçoit les commandes (plusieurs : séparés par des virgules) |
| `EMAIL_FROM` | Facultatif : expéditeur avec votre domaine vérifié sur Resend |
| `PUBLIC_URL` | URL du site (ex : https://monoshop.onrender.com), pour le lien dans l'email |
| `TIMEZONE` | Fuseau horaire du dashboard (par défaut Africa/Abidjan) |

## En local
```
npm install
DATABASE_URL=postgresql://... ADMIN_PASSWORD=... npm start
```
