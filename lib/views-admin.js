const { esc, money, intlPhone, STATUSES, statusOf } = require('./util');
const TZ = process.env.TIMEZONE || 'Africa/Abidjan';

const CSS = `
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:#f4f4f5;color:#18181b;font-size:14.5px}
a{color:#2563eb;text-decoration:none}
nav{background:#18181b;color:#fff;position:sticky;top:0;z-index:5}
nav .in{max-width:1200px;margin:0 auto;padding:0 16px;display:flex;align-items:center;gap:4px;height:54px;overflow-x:auto}
nav b{margin-right:14px;white-space:nowrap}nav a{color:#d4d4d8;padding:8px 12px;border-radius:8px;white-space:nowrap}nav a.on,nav a:hover{background:#27272a;color:#fff}
nav .sp{flex:1}
main{max-width:1200px;margin:0 auto;padding:20px 16px 60px}
h1{font-size:22px;margin:0 0 16px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:18px}
.stat{background:#fff;border-radius:12px;padding:14px;border:1px solid #e4e4e7}.stat small{color:#71717a;display:block;font-size:12.5px}.stat b{font-size:22px;display:block;margin-top:2px}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px}
select,input,textarea,button{font:inherit}
.bar select,.bar input{padding:8px 10px;border:1px solid #d4d4d8;border-radius:8px;background:#fff}
.b{display:inline-block;background:#18181b;color:#fff;border:0;border-radius:8px;padding:9px 14px;cursor:pointer;font-weight:600}
.b.light{background:#fff;color:#18181b;border:1px solid #d4d4d8}.b.red{background:#dc2626}.b.green{background:#16a34a}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #f0f0f1;vertical-align:top}th{font-size:12px;text-transform:uppercase;color:#71717a;background:#fafafa}
.pill{display:inline-block;padding:2px 9px;border-radius:99px;color:#fff;font-size:12px;font-weight:600}
.st{padding:6px 8px;border-radius:8px;border:1px solid #d4d4d8;font-weight:600}
.muted{color:#71717a;font-size:12.5px}
.acts a{display:inline-block;margin:2px 6px 2px 0;font-weight:600}
@media(max-width:820px){
  table,thead,tbody,tr,td{display:block}thead{display:none}tr{border-bottom:8px solid #f4f4f5;padding:6px 0}td{border:0;padding:5px 14px}
  td[data-l]:before{content:attr(data-l);display:block;font-size:11px;text-transform:uppercase;color:#a1a1aa}
}
.card{background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:18px;margin-bottom:16px}
.card h2{margin:0 0 12px;font-size:17px}
.fg{display:grid;gap:12px}@media(min-width:760px){.fg.two{grid-template-columns:1fr 1fr}}
.fg label{display:block;font-weight:600;font-size:13px;margin-bottom:4px}.fg .help{font-weight:400;color:#71717a;font-size:12.5px}
.fg input,.fg textarea,.fg select{width:100%;padding:9px 11px;border:1px solid #d4d4d8;border-radius:8px;background:#fff}
.fg textarea{min-height:90px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px}
.imgs{display:flex;flex-wrap:wrap;gap:10px}.imgs div{position:relative}.imgs img{width:110px;height:110px;object-fit:cover;border-radius:10px;border:1px solid #e4e4e7}
.imgs form{position:absolute;top:4px;right:4px}.imgs button{background:#dc2626;color:#fff;border:0;border-radius:6px;padding:2px 7px;cursor:pointer}
.flash{background:#dcfce7;border:1px solid #86efac;padding:10px 14px;border-radius:10px;margin-bottom:14px}
.flash.err{background:#fee2e2;border-color:#fca5a5}
.login{max-width:360px;margin:12vh auto;background:#fff;padding:28px;border-radius:16px;border:1px solid #e4e4e7}
.login input{width:100%;padding:12px;border:1px solid #d4d4d8;border-radius:10px;margin:10px 0}
.login .b{width:100%;padding:12px}
`;

function layout(title, active, body, flash) {
  const link = (href, key, label) => `<a href="${href}" class="${active === key ? 'on' : ''}">${label}</a>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} — Dashboard</title><style>${CSS}</style></head><body>
<nav><div class="in"><b>📦 Dashboard</b>${link('/admin', 'orders', 'Commandes')}${link('/admin/produits', 'products', 'Produits')}${link('/admin/parametres', 'settings', 'Paramètres')}<span class="sp"></span><a href="/" target="_blank">Voir le site ↗</a><a href="/admin/logout">Quitter</a></div></nav>
<main>${flash ? `<div class="flash ${flash.err ? 'err' : ''}">${esc(flash.msg)}</div>` : ''}${body}</main></body></html>`;
}

function loginPage(error) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Connexion</title><style>${CSS}</style></head>
<body><form class="login" method="post" action="/admin/login"><h1>🔐 Dashboard</h1>${error ? `<div class="flash err">${esc(error)}</div>` : ''}
<input type="password" name="password" placeholder="Mot de passe" required autofocus><button class="b">Se connecter</button></form></body></html>`;
}

function ordersPage({ orders, stats, products, filters, settings, total }) {
  const cur = settings.currency;
  const opt = (v, cur_, label) => `<option value="${esc(v)}" ${String(cur_) === String(v) ? 'selected' : ''}>${esc(label)}</option>`;
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();

  const rows = orders
    .map((o) => {
      const st = statusOf(o.status);
      const wa = intlPhone(o.phone, settings.phone_prefix);
      const waMsg = encodeURIComponent(
        `Bonjour ${o.customer_name.split(' ')[0]}, c'est ${settings.store_name}. Nous avons bien reçu votre commande #${o.id} : ${o.offer_label} (${money(o.total, cur)}), livraison à ${o.city}. Pouvez-vous confirmer ? Merci 🙏`
      );
      const d = new Date(o.created_at);
      return `<tr>
        <td data-l="Commande"><b>#${o.id}</b><div class="muted">${d.toLocaleDateString('fr-FR', { timeZone: TZ })} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })}</div></td>
        <td data-l="Client"><b>${esc(o.customer_name)}</b><div class="acts"><a href="tel:${esc(o.phone)}">📞 ${esc(o.phone)}</a><a href="https://wa.me/${esc(wa)}?text=${waMsg}" target="_blank" rel="noopener">💬 WhatsApp</a></div></td>
        <td data-l="Livraison">${esc(o.city)}<div class="muted">${esc(o.address)}</div>${o.note ? `<div class="muted">📝 ${esc(o.note)}</div>` : ''}</td>
        <td data-l="Produit">${esc(o.product_name)}<div class="muted">${esc(o.offer_label)}</div></td>
        <td data-l="Total"><b>${money(o.total, cur)}</b></td>
        <td data-l="Statut"><form method="post" action="/admin/commandes/${o.id}/statut">
          <select class="st" name="status" onchange="this.form.submit()" style="color:${st.color}">${STATUSES.map((s) => opt(s.key, o.status, s.label)).join('')}</select>
          <input type="hidden" name="back" value="${esc(qs)}"><noscript><button class="b light">OK</button></noscript></form></td>
      </tr>`;
    })
    .join('');

  const body = `
  <h1>Commandes</h1>
  <form class="bar" method="get">
    <select name="periode" onchange="this.form.submit()">${opt('', filters.periode, 'Toute la période')}${opt('today', filters.periode, "Aujourd'hui")}${opt('7', filters.periode, '7 derniers jours')}${opt('30', filters.periode, '30 derniers jours')}</select>
    <select name="produit" onchange="this.form.submit()">${opt('', filters.produit, 'Tous les produits')}${products.map((p) => opt(p.id, filters.produit, p.name)).join('')}</select>
    <select name="statut" onchange="this.form.submit()">${opt('', filters.statut, 'Tous les statuts')}${STATUSES.map((s) => opt(s.key, filters.statut, s.label)).join('')}</select>
    <input name="q" value="${esc(filters.q || '')}" placeholder="Nom, téléphone, ville…">
    <button class="b light">Filtrer</button>
    <span style="flex:1"></span>
    <a class="b" href="/admin/commandes.csv?${qs}">⬇ Export Excel (CSV)</a>
  </form>
  <div class="stats">
    <div class="stat"><small>Commandes</small><b>${stats.total}</b></div>
    <div class="stat"><small>À traiter (nouvelles)</small><b style="color:#2563eb">${stats.nouvelle}</b></div>
    <div class="stat"><small>Taux de confirmation</small><b>${stats.confRate}</b></div>
    <div class="stat"><small>Taux de livraison</small><b>${stats.delivRate}</b></div>
    <div class="stat"><small>En cours (confirmé + expédié)</small><b>${money(stats.pending, cur)}</b></div>
    <div class="stat"><small>Encaissé (livré)</small><b style="color:#16a34a">${money(stats.revenue, cur)}</b></div>
  </div>
  ${orders.length ? `<table><thead><tr><th>#</th><th>Client</th><th>Livraison</th><th>Produit</th><th>Total</th><th>Statut</th></tr></thead><tbody>${rows}</tbody></table>
  ${total > orders.length ? `<p class="muted">${orders.length} commandes affichées sur ${total}. Affinez les filtres ou utilisez l'export.</p>` : ''}`
    : `<div class="card">Aucune commande pour le moment. Elles apparaîtront ici dès qu'un client commande.</div>`}`;
  return body;
}

function productsPage(products, settings) {
  return `<h1>Produits</h1>
  <p><a class="b" href="/admin/produits/nouveau">+ Nouveau produit</a></p>
  <table><thead><tr><th>Produit</th><th>Prix</th><th>Commandes</th><th>Statut</th><th></th></tr></thead><tbody>
  ${products
    .map(
      (p) => `<tr>
    <td data-l="Produit"><b>${esc(p.name)}</b><div class="muted">/p/${esc(p.slug)}</div></td>
    <td data-l="Prix">${p.offers[0] ? money(p.offers[0].price, settings.currency) : '—'}</td>
    <td data-l="Commandes">${p.order_count}</td>
    <td data-l="Statut">${p.active ? '<span class="pill" style="background:#16a34a">En ligne</span>' : '<span class="pill" style="background:#71717a">Hors ligne</span>'}</td>
    <td><a href="/admin/produits/${p.id}">Modifier</a> · <a href="/p/${esc(p.slug)}" target="_blank">Voir ↗</a></td></tr>`
    )
    .join('')}</tbody></table>`;
}

function productForm(p, images) {
  const isNew = !p.id;
  const offers = (p.offers || []).map((o) => [o.label, o.qty, o.price, o.badge || ''].join(' | ')).join('\n');
  const faq = (p.faq || []).map((f) => `${f.q} | ${f.a}`).join('\n');
  return `<h1>${isNew ? 'Nouveau produit' : esc(p.name)}</h1>
  ${isNew ? '' : `<div class="card"><h2>Photos</h2>
    <p class="muted">La 1ère photo est la photo principale. Utilisez vos propres photos (carrées de préférence, max 5 Mo).</p>
    <div class="imgs">${images.map((id) => `<div><img src="/img/${id}" alt=""><form method="post" action="/admin/produits/${p.id}/photos/${id}/supprimer" onsubmit="return confirm('Supprimer cette photo ?')"><button title="Supprimer">✕</button></form></div>`).join('') || '<span class="muted">Aucune photo pour l’instant.</span>'}</div>
    <form method="post" action="/admin/produits/${p.id}/photos" enctype="multipart/form-data" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
      <input type="file" name="photos" accept="image/*" multiple required><button class="b">Ajouter les photos</button></form></div>`}
  <form method="post" action="/admin/produits/${isNew ? 'nouveau' : p.id}">
  <div class="card"><h2>Informations</h2><div class="fg two">
    <div><label>Nom du produit</label><input name="name" required value="${esc(p.name || '')}"></div>
    <div><label>Adresse de la page <span class="help">(lettres, chiffres, tirets)</span></label><input name="slug" value="${esc(p.slug || '')}" placeholder="auto"></div>
    <div><label>Titre accrocheur</label><input name="headline" value="${esc(p.headline || '')}"></div>
    <div><label>Couleur principale</label><input type="color" name="accent" value="${esc(p.accent || '#ff5a1f')}" style="height:40px"></div>
  </div><div class="fg" style="margin-top:12px">
    <div><label>Sous-titre</label><input name="subheadline" value="${esc(p.subheadline || '')}"></div>
    <div><label>Description <span class="help">(laissez une ligne vide entre les paragraphes)</span></label><textarea name="description" style="font-family:inherit;min-height:140px">${esc(p.description || '')}</textarea></div>
    <div><label>Lien vidéo MP4 <span class="help">(facultatif)</span></label><input name="video_url" value="${esc(p.video_url || '')}" placeholder="https://…/video.mp4"></div>
    <div><label><input type="checkbox" name="active" value="1" ${p.active !== false ? 'checked' : ''} style="width:auto"> Produit en ligne (visible et commandable)</label></div>
  </div></div>
  <div class="card"><h2>Prix et offres</h2><div class="fg">
    <div><label>Offres <span class="help">— une par ligne : <code>Texte | Quantité | Prix | Badge (facultatif)</code></span></label><textarea name="offers" required>${esc(offers)}</textarea></div>
    <div><label>Prix barré (pour 1 unité) <span class="help">— facultatif, laissez vide si aucun</span></label><input name="compare_price" type="number" min="0" value="${esc(p.compare_price ?? '')}"></div>
  </div></div>
  <div class="card"><h2>Arguments et FAQ</h2><div class="fg">
    <div><label>Avantages <span class="help">— un par ligne</span></label><textarea name="benefits">${esc((p.benefits || []).join('\n'))}</textarea></div>
    <div><label>FAQ <span class="help">— une par ligne : <code>Question | Réponse</code></span></label><textarea name="faq">${esc(faq)}</textarea></div>
  </div></div>
  <button class="b green" style="padding:12px 22px">💾 Enregistrer</button>
  </form>
  ${isNew ? '' : `<form method="post" action="/admin/produits/${p.id}/supprimer" onsubmit="return confirm('Supprimer définitivement ce produit ? Les commandes sont conservées.')" style="margin-top:30px"><button class="b red">Supprimer le produit</button></form>`}`;
}

function settingsPage(s, env) {
  const f = (name, label, help = '') =>
    `<div><label>${label} ${help ? `<span class="help">${help}</span>` : ''}</label><input name="${name}" value="${esc(s[name])}"></div>`;
  return `<h1>Paramètres</h1>
  <form method="post" action="/admin/parametres">
  <div class="card"><h2>Boutique</h2><div class="fg two">
    ${f('store_name', 'Nom de la boutique')}
    ${f('country', 'Pays')}
    ${f('currency', 'Devise affichée', '(ex : FCFA)')}
    ${f('currency_code', 'Code devise pour les pixels', '(XOF Afrique de l’Ouest, XAF Afrique centrale)')}
    ${f('phone_prefix', 'Indicatif téléphonique', '(sans +, ex : 225, 221, 237)')}
    ${f('whatsapp', 'Votre numéro WhatsApp', '(avec indicatif, ex : 2250700000000) — bouton sur le site')}
    ${f('delivery_text', 'Texte livraison', '(en haut du site)')}
  </div></div>
  <div class="card"><h2>Pixels publicitaires</h2><div class="fg two">
    ${f('fb_pixel_id', 'ID Pixel Facebook / Meta', '(facultatif)')}
    ${f('tiktok_pixel_id', 'ID Pixel TikTok', '(facultatif)')}
  </div><p class="muted">Événements envoyés : PageView, ViewContent sur la page produit, Purchase / PlaceAnOrder après la commande.</p></div>
  <button class="b green" style="padding:12px 22px">💾 Enregistrer</button></form>
  <div class="card" style="margin-top:16px"><h2>Notification email</h2>
    <p>Envoi des emails : ${env.resend ? '✅ clé Resend configurée' : '❌ <b>RESEND_API_KEY</b> manquante'} · Destinataire : ${env.to ? `✅ ${esc(env.to)}` : '❌ <b>ORDER_EMAIL</b> manquant'}</p>
    <p class="muted">Ces réglages se font dans Render → votre service → Environment.</p>
    <form method="post" action="/admin/test-email"><button class="b light">Envoyer un email de test</button></form></div>`;
}

module.exports = { layout, loginPage, ordersPage, productsPage, productForm, settingsPage };
