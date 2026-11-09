import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';

const C = window.SHOP_CONFIG;
const sb = createClient(C.supabaseUrl, C.supabaseKey);
const root = document.getElementById('root');
const TZ = 'Africa/Abidjan';

const STATUSES = [
  { key: 'nouvelle', label: 'Nouvelle', color: '#2563eb' },
  { key: 'injoignable', label: 'Injoignable', color: '#a16207' },
  { key: 'confirmee', label: 'Confirmée', color: '#7c3aed' },
  { key: 'expediee', label: 'Expédiée', color: '#0891b2' },
  { key: 'livree', label: 'Livrée / payée', color: '#16a34a' },
  { key: 'retour', label: 'Refusée / retour', color: '#dc2626' },
  { key: 'annulee', label: 'Annulée', color: '#6b7280' },
];
const statusOf = (k) => STATUSES.find((s) => s.key === k) || STATUSES[0];
const SETTING_KEYS = ['store_name', 'country', 'currency', 'currency_code', 'phone_prefix', 'whatsapp', 'delivery_text', 'fb_pixel_id', 'tiktok_pixel_id'];

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const money = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ' + (state.settings.currency || '');
const slugify = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'produit';
const fmtDate = (d) => new Date(d).toLocaleString('fr-FR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const state = { settings: {}, products: [], orders: [], filters: { periode: '30', produit: '', statut: '', q: '', tri: 'recentes' }, lastId: 0, unseen: 0 };

function flash(msg, err) {
  const el = document.createElement('div');
  el.className = 'flash' + (err ? ' err' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), err ? 6000 : 2500);
}

function intlPhone(phone) {
  const prefix = state.settings.phone_prefix || '';
  let p = String(phone || '').replace(/[^\d+]/g, '');
  if (p.startsWith('+')) return p.slice(1);
  if (p.startsWith('00')) return p.slice(2);
  if (prefix && p.startsWith(prefix) && p.length > prefix.length + 7) return p;
  if (prefix !== '225') p = p.replace(/^0+(?=\d{8})/, ''); // la Côte d'Ivoire garde le 0
  return prefix + p;
}

// ---------------- Authentification ----------------
function renderLogin(mode = 'login', message = '', ok = false) {
  const signup = mode === 'signup';
  root.innerHTML = `<form class="login" id="lf">
    <h1>🔐 ${signup ? 'Créer le compte' : 'Dashboard'}</h1>
    <p class="muted">${signup ? 'Le premier compte créé devient l’administrateur de la boutique.' : 'Connectez-vous pour voir vos commandes.'}</p>
    ${message ? `<div class="msg ${ok ? 'ok' : ''}">${esc(message)}</div>` : ''}
    <input type="email" name="email" placeholder="Email" required autocomplete="email">
    <input type="password" name="password" placeholder="Mot de passe${signup ? ' (8 caractères minimum)' : ''}" required minlength="${signup ? 8 : 1}" autocomplete="${signup ? 'new-password' : 'current-password'}">
    <button class="b">${signup ? 'Créer mon compte' : 'Se connecter'}</button>
    <p style="text-align:center;margin:16px 0 0"><a href="#" id="sw">${signup ? 'J’ai déjà un compte' : 'Première fois ? Créer le compte'}</a></p>
  </form>`;
  document.getElementById('sw').onclick = (e) => { e.preventDefault(); renderLogin(signup ? 'login' : 'signup'); };
  document.getElementById('lf').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('button');
    btn.disabled = true;
    const email = f.email.value.trim(), password = f.password.value;
    if (signup) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + '/admin/' } });
      if (error) return renderLogin('signup', traduire(error.message));
      if (!data.session) return renderLogin('login', 'Compte créé ✅ Ouvrez l’email de confirmation envoyé par Supabase, cliquez sur le lien, puis connectez-vous ici.', true);
      return start();
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return renderLogin('login', traduire(error.message));
    start();
  };
}

function traduire(m) {
  if (/Invalid login/i.test(m)) return 'Email ou mot de passe incorrect.';
  if (/not confirmed/i.test(m)) return 'Email pas encore confirmé : cliquez sur le lien reçu par email.';
  if (/already registered/i.test(m)) return 'Ce compte existe déjà : connectez-vous.';
  if (/rate limit/i.test(m)) return 'Trop de tentatives. Réessayez dans quelques minutes.';
  return m;
}

async function start() {
  root.innerHTML = '<div class="center"><div class="spin"></div></div>';
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return renderLogin();
  const { data: isAdmin, error } = await sb.rpc('claim_admin');
  if (error || !isAdmin) {
    root.innerHTML = `<div class="login"><h1>Accès refusé</h1><p>Ce compte (${esc(session.user.email)}) n’est pas administrateur de la boutique.</p><button class="b" id="lo">Se déconnecter</button></div>`;
    document.getElementById('lo').onclick = async () => { await sb.auth.signOut(); renderLogin(); };
    return;
  }
  await loadSettings();
  await loadProducts();
  const { data } = await sb.from('orders').select('id').order('id', { ascending: false }).limit(1);
  state.lastId = data?.[0]?.id || 0;
  window.addEventListener('hashchange', route);
  setInterval(poll, 30000);
  route();
}

// ---------------- Données ----------------
async function loadSettings() {
  const { data } = await sb.from('settings').select('key,value');
  state.settings = { currency: 'FCFA', phone_prefix: '225', store_name: 'Ma Boutique' };
  (data || []).forEach((r) => (state.settings[r.key] = r.value));
}
async function loadProducts() {
  const { data, error } = await sb.from('products').select('*').order('id');
  if (error) flash('Erreur de chargement des produits : ' + error.message, true);
  state.products = data || [];
}
async function loadOrders() {
  let q = sb.from('orders').select('*').order('created_at', { ascending: false }).limit(2000);
  const f = state.filters;
  if (f.periode === 'today') { const d = new Date(); d.setUTCHours(0, 0, 0, 0); q = q.gte('created_at', d.toISOString()); }
  else if (f.periode) q = q.gte('created_at', new Date(Date.now() - Number(f.periode) * 864e5).toISOString());
  if (f.produit) q = q.eq('product_id', f.produit);
  const { data, error } = await q;
  if (error) flash('Erreur de chargement des commandes : ' + error.message, true);
  state.orders = data || [];
}

// ---------------- Nouvelles commandes (vérification toutes les 30 s) ----------------
let audioCtx;
document.addEventListener('click', () => { if (!audioCtx && window.AudioContext) audioCtx = new AudioContext(); }, { once: true });
function beep() {
  if (!audioCtx) return;
  [0, 0.25].forEach((t) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.25, audioCtx.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t + 0.2);
    o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.2);
  });
}
async function poll() {
  const { data } = await sb.from('orders').select('id,customer_name,city,total,product_name').gt('id', state.lastId).order('id');
  if (!data || !data.length) return;
  state.lastId = data[data.length - 1].id;
  state.unseen += data.length;
  beep();
  if ('Notification' in window && Notification.permission === 'granted') {
    const o = data[data.length - 1];
    try { new Notification(data.length > 1 ? `${data.length} nouvelles commandes` : 'Nouvelle commande 🛒', { body: `${o.customer_name} — ${o.city} — ${money(o.total)}\n${o.product_name}`, icon: '/admin/icon-192.png' }); } catch (e) {}
  }
  document.title = `(${state.unseen}) Nouvelles commandes`;
  if (currentView === 'orders') { await loadOrders(); renderOrders(); } else updateNav();
}

// ---------------- Mise en page ----------------
let currentView = '';
function shell(view, html) {
  currentView = view;
  const link = (h, k, l) => `<a href="${h}" class="${view === k ? 'on' : ''}">${l}</a>`;
  root.innerHTML = `<nav><div class="in"><b>📦 ${esc(state.settings.store_name)}</b>
    ${link('#/', 'orders', 'Commandes<span id="cnt"></span>')}${link('#/produits', 'products', 'Produits')}${link('#/parametres', 'settings', 'Paramètres')}
    <span class="sp"></span><a href="/" target="_blank">Voir le site ↗</a><a href="#" id="lo">Quitter</a></div></nav><main>${html}</main>`;
  document.getElementById('lo').onclick = async (e) => { e.preventDefault(); await sb.auth.signOut(); location.hash = ''; location.reload(); };
  updateNav();
}
function updateNav() {
  const el = document.getElementById('cnt');
  if (el) el.innerHTML = state.unseen ? `<span class="cnt">${state.unseen}</span>` : '';
}

async function route() {
  const h = location.hash.replace(/^#\/?/, '');
  if (h === 'produits') { await loadProducts(); return renderProducts(); }
  if (h === 'produit/nouveau') return renderProductForm(null);
  if (h.startsWith('produit/')) { await loadProducts(); return renderProductForm(state.products.find((p) => String(p.id) === h.split('/')[1])); }
  if (h === 'parametres') return renderSettings();
  await loadOrders();
  renderOrders();
}

// ---------------- Commandes ----------------
function soutenanceInfo(o) {
  const d = o.extra && o.extra.soutenance;
  if (!d) return '';
  const days = Math.round((new Date(d + 'T00:00:00Z') - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')) / 864e5);
  const label = days < 0 ? 'passée' : days === 0 ? "aujourd'hui" : days === 1 ? 'demain' : `dans ${days} j`;
  const color = days <= 3 ? '#dc2626' : days <= 7 ? '#d97706' : '#16a34a';
  return `<div style="color:${color};font-weight:700">🎓 Soutenance ${new Date(d + 'T00:00:00Z').toLocaleDateString('fr-FR', { timeZone: 'UTC' })} (${label})</div>`;
}

function computeStats(orders) {
  const by = Object.fromEntries(STATUSES.map((s) => [s.key, { n: 0, sum: 0 }]));
  orders.forEach((o) => { by[o.status].n++; by[o.status].sum += o.total; });
  const total = orders.length;
  const confirmed = by.confirmee.n + by.expediee.n + by.livree.n + by.retour.n;
  const treated = total - by.nouvelle.n;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) + ' %' : '—');
  return {
    total, nouvelle: by.nouvelle.n,
    confRate: pct(confirmed, treated),
    delivRate: pct(by.livree.n, by.livree.n + by.retour.n),
    pending: by.confirmee.sum + by.expediee.sum,
    revenue: by.livree.sum,
  };
}

function filteredOrders() {
  const f = state.filters, q = f.q.trim().toLowerCase().replace(/^#/, '');
  const list = state.orders.filter((o) => (!f.statut || o.status === f.statut) &&
    (!q || String(o.id) === q || [o.customer_name, o.phone, o.city, o.address, o.extra?.ecole, o.extra?.theme].some((v) => String(v ?? '').toLowerCase().includes(q))));
  if (f.tri === 'soutenance') list.sort((a, b) => (a.extra?.soutenance || '9999') .localeCompare(b.extra?.soutenance || '9999'));
  return list;
}

function renderOrders() {
  state.unseen = 0;
  document.title = 'Commandes — Dashboard';
  const f = state.filters, st = computeStats(state.orders), list = filteredOrders();
  const opt = (v, cur, l) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
  const notifAsk = 'Notification' in window && Notification.permission === 'default';

  const rows = list.map((o) => {
    const s = statusOf(o.status);
    const ex = o.extra || {};
    const isSvc = !!(ex.ecole || ex.theme);
    const waMsg = encodeURIComponent(isSvc
      ? `Bonjour ${o.customer_name.split(' ')[0]}, c'est ${state.settings.store_name}. Nous avons bien reçu votre commande #${o.id} : ${o.offer_label} (${money(o.total)}). Pouvez-vous nous envoyer votre mémoire (Word ou PDF) ici ? Merci 🙏`
      : `Bonjour ${o.customer_name.split(' ')[0]}, c'est ${state.settings.store_name}. Nous avons bien reçu votre commande #${o.id} : ${o.offer_label} (${money(o.total)}), livraison à ${o.city}. Pouvez-vous confirmer ? Merci 🙏`);
    return `<tr class="${o.status === 'nouvelle' ? 'new' : ''}">
      <td data-l="Commande"><b>#${o.id}</b><div class="muted">${fmtDate(o.created_at)}</div></td>
      <td data-l="Client"><b>${esc(o.customer_name)}</b><div class="acts"><a href="tel:${esc(o.phone)}">📞 ${esc(o.phone)}</a><a href="https://wa.me/${esc(intlPhone(o.phone))}?text=${waMsg}" target="_blank" rel="noopener">💬 WhatsApp</a></div></td>
      <td data-l="Livraison">${esc(o.city)}<div class="muted">${esc(o.address)}</div>${o.note ? `<div class="muted">📝 ${esc(o.note)}</div>` : ''}</td>
      <td data-l="Produit">${esc(o.product_name)}<div class="muted">${esc(o.offer_label)}</div>${isSvc ? `<div class="muted">🏫 ${esc(ex.ecole || '')}${ex.niveau ? ' · ' + esc(ex.niveau) : ''}</div><div class="muted">📘 ${esc(ex.theme || '')}</div>` : ''}${soutenanceInfo(o)}</td>
      <td data-l="Total"><b>${money(o.total)}</b></td>
      <td data-l="Statut"><select class="st" data-id="${o.id}" style="color:${s.color}">${STATUSES.map((x) => opt(x.key, o.status, x.label)).join('')}</select></td>
    </tr>`;
  }).join('');

  shell('orders', `
    <h1>Commandes</h1>
    ${notifAsk ? `<div class="notif">🔔 Soyez alerté (son + notification) dès qu’une commande arrive, tant que cette page est ouverte. <button class="b" id="notif">Activer les alertes</button></div>` : ''}
    <div class="bar">
      <select id="fp">${opt('today', f.periode, "Aujourd'hui")}${opt('7', f.periode, '7 derniers jours')}${opt('30', f.periode, '30 derniers jours')}${opt('', f.periode, 'Toute la période')}</select>
      <select id="fpr">${opt('', f.produit, 'Tous les produits')}${state.products.map((p) => opt(p.id, f.produit, p.name)).join('')}</select>
      <select id="fs">${opt('', f.statut, 'Tous les statuts')}${STATUSES.map((s) => opt(s.key, f.statut, s.label)).join('')}</select>
      <select id="ft">${opt('recentes', f.tri, 'Plus récentes')}${opt('soutenance', f.tri, 'Soutenance la plus proche')}</select>
      <input id="fq" value="${esc(f.q)}" placeholder="Nom, téléphone, ville…" type="search">
      <span style="flex:1"></span>
      <button class="b light" id="refresh">↻ Actualiser</button>
      <button class="b" id="csv">⬇ Export Excel</button>
    </div>
    <div class="stats">
      <div class="stat"><small>Commandes</small><b>${st.total}</b></div>
      <div class="stat"><small>À traiter (nouvelles)</small><b style="color:#2563eb">${st.nouvelle}</b></div>
      <div class="stat"><small>Taux de confirmation</small><b>${st.confRate}</b></div>
      <div class="stat"><small>Taux de livraison</small><b>${st.delivRate}</b></div>
      <div class="stat"><small>En cours (confirmé + expédié)</small><b>${money(st.pending)}</b></div>
      <div class="stat"><small>Encaissé (livré)</small><b style="color:#16a34a">${money(st.revenue)}</b></div>
    </div>
    ${list.length ? `<table><thead><tr><th>#</th><th>Client</th><th>Livraison</th><th>Produit</th><th>Total</th><th>Statut</th></tr></thead><tbody>${rows}</tbody></table>`
      : `<div class="card">${state.orders.length ? 'Aucune commande ne correspond aux filtres.' : 'Aucune commande pour le moment. Elles apparaîtront ici dès qu’un client commande.'}</div>`}`);

  const reload = async () => { await loadOrders(); renderOrders(); };
  document.getElementById('fp').onchange = (e) => { f.periode = e.target.value; reload(); };
  document.getElementById('fpr').onchange = (e) => { f.produit = e.target.value; reload(); };
  document.getElementById('fs').onchange = (e) => { f.statut = e.target.value; renderOrders(); };
  document.getElementById('ft').onchange = (e) => { f.tri = e.target.value; renderOrders(); };
  let t; document.getElementById('fq').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value; renderOrders(); const i = document.getElementById('fq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 300); };
  document.getElementById('refresh').onclick = reload;
  document.getElementById('csv').onclick = () => exportCsv(list);
  const nb = document.getElementById('notif');
  if (nb) nb.onclick = async () => { await Notification.requestPermission(); if (!audioCtx && window.AudioContext) audioCtx = new AudioContext(); renderOrders(); };
  root.querySelectorAll('select.st').forEach((sel) => {
    sel.onchange = async () => {
      const id = Number(sel.dataset.id), status = sel.value;
      sel.disabled = true;
      const { error } = await sb.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) { flash('Erreur : ' + error.message, true); sel.disabled = false; return; }
      state.orders.find((o) => o.id === id).status = status;
      flash(`#${id} → ${statusOf(status).label}`);
      renderOrders();
    };
  });
}

function exportCsv(list) {
  const cell = (v) => { let t = String(v ?? ''); if (/^[=+\-@]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
  const head = ['N°', 'Date', 'Client', 'Téléphone', 'Ville', 'Adresse', 'Produit', 'Offre', 'Quantité', 'Total', 'Statut', 'Note', 'École', 'Niveau', 'Thème', 'Soutenance'];
  const lines = list.map((o) => [o.id, new Date(o.created_at).toLocaleString('fr-FR', { timeZone: TZ }), o.customer_name, o.phone, o.city, o.address, o.product_name, o.offer_label, o.quantity, o.total, statusOf(o.status).label, o.note, o.extra?.ecole, o.extra?.niveau, o.extra?.theme, o.extra?.soutenance].map(cell).join(';'));
  const blob = new Blob(['﻿' + [head.map(cell).join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `commandes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------------- Produits ----------------
async function renderProducts() {
  const { data } = await sb.from('orders').select('product_id');
  const counts = {};
  (data || []).forEach((o) => (counts[o.product_id] = (counts[o.product_id] || 0) + 1));
  shell('products', `<h1>Produits</h1>
    <p><a class="b" href="#/produit/nouveau">+ Nouveau produit</a></p>
    <table><thead><tr><th>Produit</th><th>Prix</th><th>Commandes</th><th>Statut</th><th></th></tr></thead><tbody>
    ${state.products.map((p) => `<tr>
      <td data-l="Produit"><b>${esc(p.name)}</b><div class="muted">/p/${esc(p.slug)}</div></td>
      <td data-l="Prix">${p.offers[0] ? money(p.offers[0].price) : '—'}</td>
      <td data-l="Commandes">${counts[p.id] || 0}</td>
      <td data-l="Statut">${p.active ? '<span class="pill" style="background:#16a34a">En ligne</span>' : '<span class="pill" style="background:#71717a">Hors ligne</span>'}</td>
      <td><a href="#/produit/${p.id}">Modifier</a> · <a href="/p/${esc(p.slug)}" target="_blank">Voir ↗</a></td></tr>`).join('')}
    </tbody></table>`);
}

function renderProductForm(p) {
  const isNew = !p;
  p = p || { kind: 'physique', name: '', slug: '', accent: '#ff5a1f', active: true, headline: '', subheadline: '', description: '', benefits: [], faq: [], images: [], video_url: '', compare_price: null,
    offers: [{ label: '1 article', qty: 1, price: 10000, badge: '' }, { label: '2 articles', qty: 2, price: 18000, badge: 'Meilleure offre' }] };
  const offers = p.offers.map((o) => [o.label, o.qty, o.price, o.badge || ''].join(' | ')).join('\n');
  const faq = p.faq.map((x) => `${x.q} | ${x.a}`).join('\n');

  shell('products', `<p><a href="#/produits">← Produits</a></p><h1>${isNew ? 'Nouveau produit' : esc(p.name)}</h1>
    ${isNew ? '<div class="card muted">Enregistrez d’abord le produit, vous pourrez ensuite ajouter les photos.</div>' : `<div class="card"><h2>Photos</h2>
      <p class="muted">La 1ère photo est la photo principale. Utilisez vos propres photos (carrées de préférence). Elles sont automatiquement allégées.</p>
      <div class="imgs">${p.images.map((u, i) => `<div><img src="${esc(u)}" alt=""><button class="x" data-i="${i}" title="Supprimer">✕</button>${i ? `<button class="first" data-i="${i}">★ Principale</button>` : ''}</div>`).join('') || '<span class="muted">Aucune photo pour l’instant.</span>'}</div>
      <p style="margin:12px 0 0"><label class="b" style="display:inline-block">📷 Ajouter des photos<input type="file" id="ph" accept="image/*" multiple hidden></label> <span id="up" class="muted"></span></p></div>`}
    <form id="pf">
    <div class="card"><h2>Informations</h2><div class="fg two">
      <div><label>Nom du produit</label><input name="name" required value="${esc(p.name)}"></div>
      <div><label>Adresse de la page <span class="help">(lettres, chiffres, tirets)</span></label><input name="slug" value="${esc(p.slug)}" placeholder="automatique"></div>
      <div><label>Titre accrocheur</label><input name="headline" value="${esc(p.headline)}"></div>
      <div><label>Couleur principale</label><input type="color" name="accent" value="${esc(p.accent)}" style="height:40px;padding:2px"></div>
      <div><label>Type</label><select name="kind"><option value="physique" ${p.kind !== 'service' ? 'selected' : ''}>Produit physique (livraison)</option><option value="service" ${p.kind === 'service' ? 'selected' : ''}>Service étudiant (école, niveau, thème, date de soutenance)</option></select></div>
    </div><div class="fg" style="margin-top:12px">
      <div><label>Sous-titre</label><input name="subheadline" value="${esc(p.subheadline)}"></div>
      <div><label>Description <span class="help">(laissez une ligne vide entre les paragraphes)</span></label><textarea name="description" class="prose">${esc(p.description)}</textarea></div>
      <div><label>Lien vidéo MP4 <span class="help">(facultatif)</span></label><input name="video_url" value="${esc(p.video_url)}" placeholder="https://…/video.mp4"></div>
      <div><label style="font-weight:600"><input type="checkbox" name="active" ${p.active ? 'checked' : ''} style="width:auto"> Produit en ligne (visible et commandable)</label></div>
    </div></div>
    <div class="card"><h2>Prix et offres</h2><div class="fg">
      <div><label>Offres <span class="help">— une par ligne : <code>Texte | Quantité | Prix | Badge (facultatif)</code></span></label><textarea name="offers" required>${esc(offers)}</textarea></div>
      <div><label>Prix barré pour 1 unité <span class="help">— facultatif</span></label><input name="compare_price" type="number" min="0" value="${esc(p.compare_price ?? '')}"></div>
    </div></div>
    <div class="card"><h2>Arguments et FAQ</h2><div class="fg">
      <div><label>Avantages <span class="help">— un par ligne</span></label><textarea name="benefits">${esc(p.benefits.join('\n'))}</textarea></div>
      <div><label>FAQ <span class="help">— une par ligne : <code>Question | Réponse</code></span></label><textarea name="faq">${esc(faq)}</textarea></div>
    </div></div>
    <button class="b green" style="padding:12px 22px">💾 Enregistrer</button>
    ${isNew ? '' : '<a class="b light" href="/p/' + esc(p.slug) + '" target="_blank" style="margin-left:8px">Voir la page ↗</a>'}
    </form>
    ${isNew ? '' : '<p style="margin-top:36px"><button class="b red" id="del">Supprimer le produit</button></p>'}`);

  document.getElementById('pf').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('button.green');
    const lines = (t) => t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const offersArr = lines(f.offers.value).map((l) => {
      const [label, qty, price, badge] = l.split('|').map((x) => (x || '').trim());
      return { label, qty: Math.max(1, parseInt(qty, 10) || 1), price: Math.max(0, parseInt(String(price).replace(/\D/g, ''), 10) || 0), badge: badge || '' };
    }).filter((o) => o.label);
    if (!offersArr.length) return flash('Ajoutez au moins une offre.', true);
    const cp = parseInt(f.compare_price.value, 10);
    const row = {
      name: f.name.value.trim(), slug: slugify(f.slug.value || f.name.value), headline: f.headline.value.trim(), subheadline: f.subheadline.value.trim(),
      description: f.description.value.trim(), accent: f.accent.value, active: f.active.checked, kind: f.kind.value,
      video_url: /^https?:\/\//.test(f.video_url.value.trim()) ? f.video_url.value.trim() : '',
      offers: offersArr, benefits: lines(f.benefits.value),
      faq: lines(f.faq.value).map((l) => { const i = l.indexOf('|'); return i > 0 ? { q: l.slice(0, i).trim(), a: l.slice(i + 1).trim() } : null; }).filter(Boolean),
      compare_price: cp > 0 ? cp : null,
    };
    btn.disabled = true;
    const res = isNew ? await sb.from('products').insert(row).select().single() : await sb.from('products').update(row).eq('id', p.id).select().single();
    btn.disabled = false;
    if (res.error) return flash(res.error.code === '23505' ? 'Cette adresse de page est déjà utilisée.' : 'Erreur : ' + res.error.message, true);
    flash('Produit enregistré ✅');
    await loadProducts();
    if (isNew) location.hash = '#/produit/' + res.data.id; else renderProductForm(res.data);
  };

  if (isNew) return;
  const saveImages = async (images) => {
    const { data, error } = await sb.from('products').update({ images }).eq('id', p.id).select().single();
    if (error) { flash('Erreur : ' + error.message, true); return; }
    renderProductForm(data);
  };
  document.getElementById('ph').onchange = async (e) => {
    const files = [...e.target.files], up = document.getElementById('up');
    const images = [...p.images];
    for (let i = 0; i < files.length; i++) {
      up.textContent = `Envoi ${i + 1}/${files.length}…`;
      try {
        const blob = await resizeImage(files[i]);
        const path = `${p.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await sb.storage.from(C.imageBucket).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
        if (error) throw error;
        images.push(sb.storage.from(C.imageBucket).getPublicUrl(path).data.publicUrl);
      } catch (err) { flash(`Photo « ${files[i].name} » : ${err.message || 'format non supporté'}`, true); }
    }
    await saveImages(images);
    flash('Photos ajoutées ✅');
  };
  root.querySelectorAll('.imgs .x').forEach((b) => (b.onclick = async () => {
    if (!confirm('Supprimer cette photo ?')) return;
    const i = Number(b.dataset.i), url = p.images[i];
    const path = url.split(`/object/public/${C.imageBucket}/`)[1];
    if (path) await sb.storage.from(C.imageBucket).remove([decodeURIComponent(path)]);
    await saveImages(p.images.filter((_, j) => j !== i));
  }));
  root.querySelectorAll('.imgs .first').forEach((b) => (b.onclick = () => {
    const i = Number(b.dataset.i), imgs = [...p.images];
    imgs.unshift(imgs.splice(i, 1)[0]);
    saveImages(imgs);
  }));
  document.getElementById('del').onclick = async () => {
    if (!confirm('Supprimer définitivement ce produit ? Les commandes déjà reçues sont conservées.')) return;
    const paths = p.images.map((u) => u.split(`/object/public/${C.imageBucket}/`)[1]).filter(Boolean).map(decodeURIComponent);
    if (paths.length) await sb.storage.from(C.imageBucket).remove(paths);
    const { error } = await sb.from('products').delete().eq('id', p.id);
    if (error) return flash('Erreur : ' + error.message, true);
    flash('Produit supprimé');
    location.hash = '#/produits';
  };
}

async function resizeImage(file, max = 1400) {
  const bmp = await createImageBitmap(file);
  const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('conversion impossible'))), 'image/jpeg', 0.85));
}

// ---------------- Paramètres ----------------
function renderSettings() {
  const s = state.settings;
  const f = (k, label, help = '') => `<div><label>${label} ${help ? `<span class="help">${help}</span>` : ''}</label><input name="${k}" value="${esc(s[k] || '')}"></div>`;
  shell('settings', `<h1>Paramètres</h1><form id="sf">
    <div class="card"><h2>Boutique</h2><div class="fg two">
      ${f('store_name', 'Nom de la boutique')}
      ${f('country', 'Pays')}
      ${f('currency', 'Devise affichée', '(ex : FCFA)')}
      ${f('currency_code', 'Code devise pour les pixels', '(XOF Afrique de l’Ouest, XAF Afrique centrale)')}
      ${f('phone_prefix', 'Indicatif téléphonique', '(sans +, ex : 225, 221, 237)')}
      ${f('whatsapp', 'Votre numéro WhatsApp', '(avec indicatif, ex : 2250700000000)')}
      ${f('delivery_text', 'Texte livraison', '(en haut du site)')}
    </div></div>
    <div class="card"><h2>Pixels publicitaires</h2><div class="fg two">
      ${f('fb_pixel_id', 'ID Pixel Facebook / Meta', '(facultatif)')}
      ${f('tiktok_pixel_id', 'ID Pixel TikTok', '(facultatif)')}
    </div><p class="muted">Événements envoyés : PageView et ViewContent sur la page produit, Purchase (Meta) et PlaceAnOrder (TikTok) après la commande.</p></div>
    <button class="b green" style="padding:12px 22px">💾 Enregistrer</button></form>`);
  document.getElementById('sf').onsubmit = async (e) => {
    e.preventDefault();
    const rows = SETTING_KEYS.map((key) => ({ key, value: e.target[key].value.trim() }));
    const { error } = await sb.from('settings').upsert(rows);
    if (error) return flash('Erreur : ' + error.message, true);
    await loadSettings();
    flash('Paramètres enregistrés ✅');
    renderSettings();
  };
}

sb.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') renderLogin(); });
start();
