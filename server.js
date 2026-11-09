const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const db = require('./lib/db');
const { seed } = require('./lib/seed');
const { sendOrderEmail } = require('./lib/email');
const { esc, sign, STATUSES, slugify } = require('./lib/util');
const pub = require('./lib/views-public');
const adm = require('./lib/views-admin');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false, limit: '200kb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});

const parseProduct = (r) => r && { ...r, benefits: r.benefits || [], faq: r.faq || [], offers: r.offers || [], image_ids: r.image_ids || [] };

// ---------- Anti-spam simple (mémoire) ----------
const hits = new Map();
function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

// ---------- Pages publiques ----------
// Utilisé par le robot de surveillance (UptimeRobot) : garde le site éveillé ET la base Supabase active
app.get('/healthz', async (req, res) => {
  try { await db.q('SELECT 1'); res.send('ok'); } catch (e) { res.status(503).send('db down'); }
});

app.get('/', async (req, res, next) => {
  try {
    const s = await db.getSettings();
    const { rows } = await db.q('SELECT * FROM products WHERE active ORDER BY id');
    if (rows.length === 1) return res.redirect(`/p/${rows[0].slug}`);
    res.send(pub.homePage(rows.map(parseProduct), s));
  } catch (e) { next(e); }
});

app.get('/p/:slug', async (req, res, next) => {
  try {
    const s = await db.getSettings();
    const { rows } = await db.q('SELECT * FROM products WHERE slug = $1 AND active', [req.params.slug]);
    if (!rows[0]) return res.status(404).send(pub.notFound(s));
    const p = parseProduct(rows[0]);
    res.send(pub.productPage(p, s, p.image_ids));
  } catch (e) { next(e); }
});

app.post('/p/:slug/commande', async (req, res, next) => {
  try {
    const s = await db.getSettings();
    const { rows } = await db.q('SELECT * FROM products WHERE slug = $1 AND active', [req.params.slug]);
    if (!rows[0]) return res.status(404).send(pub.notFound(s));
    const p = parseProduct(rows[0]);
    const b = req.body;
    if (b.website) return res.redirect(`/p/${p.slug}`); // robot (champ piège rempli)
    if (rateLimited('o:' + req.ip, 6, 10 * 60 * 1000)) return res.status(429).send('Trop de commandes. Réessayez dans quelques minutes.');

    const clean = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
    const name = clean(b.name, 80), phone = clean(b.phone, 20), city = clean(b.city, 60);
    const offer = p.offers[parseInt(b.offer, 10)] || p.offers[0];
    if (!name || !city || phone.replace(/\D/g, '').length < 8 || !offer) {
      return res.status(400).send('Merci de remplir votre nom, un numéro de téléphone valide et votre ville. <a href="javascript:history.back()">Retour</a>');
    }
    const ins = await db.q(
      `INSERT INTO orders (product_id, product_name, offer_label, quantity, total, customer_name, phone, city, address, note, ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [p.id, p.name, offer.label, offer.qty, offer.price, name, phone, city, clean(b.address, 160), clean(b.note, 300), req.ip]
    );
    const order = ins.rows[0];
    sendOrderEmail(order, s); // en arrière-plan, ne bloque pas le client
    res.redirect(303, `/merci/${order.id}?t=${sign('order:' + order.id)}`);
  } catch (e) { next(e); }
});

app.get('/merci/:id', async (req, res, next) => {
  try {
    const s = await db.getSettings();
    if (req.query.t !== sign('order:' + req.params.id)) return res.status(404).send(pub.notFound(s));
    const { rows } = await db.q('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).send(pub.notFound(s));
    const pr = await db.q('SELECT * FROM products WHERE id = $1', [rows[0].product_id]);
    res.set('Cache-Control', 'no-store').send(pub.thanksPage(rows[0], pr.rows[0], s));
  } catch (e) { next(e); }
});

app.get('/img/:id', async (req, res, next) => {
  try {
    const { rows } = await db.q('SELECT mime, data FROM images WHERE id = $1', [parseInt(req.params.id, 10) || 0]);
    if (!rows[0]) return res.sendStatus(404);
    res.set('Content-Type', rows[0].mime).set('Cache-Control', 'public, max-age=31536000, immutable').send(rows[0].data);
  } catch (e) { next(e); }
});

// ---------- Authentification dashboard ----------
const COOKIE = 'adm';
const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
function isAdmin(req) {
  const v = cookies(req)[COOKIE];
  if (!v) return false;
  const [exp, sig] = v.split('.');
  return Number(exp) > Date.now() && sig === sign('admin:' + exp);
}
function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  res.redirect('/admin/login');
}
const flash = (res, msg, err) => res.set('Set-Cookie', `fl=${encodeURIComponent((err ? '!' : '') + msg)}; Path=/admin; Max-Age=20; HttpOnly; SameSite=Lax`);
function readFlash(req, res) {
  const v = cookies(req).fl;
  if (!v) return null;
  res.append('Set-Cookie', 'fl=; Path=/admin; Max-Age=0');
  return v.startsWith('!') ? { msg: v.slice(1), err: true } : { msg: v };
}

app.get('/admin/login', (req, res) => res.send(adm.loginPage()));
app.post('/admin/login', async (req, res) => {
  const pw = process.env.ADMIN_PASSWORD;
  if (rateLimited('l:' + req.ip, 8, 15 * 60 * 1000)) return res.status(429).send(adm.loginPage('Trop de tentatives, réessayez dans 15 minutes.'));
  const given = Buffer.from(String(req.body.password || ''));
  const ok = pw && given.length === Buffer.byteLength(pw) && crypto.timingSafeEqual(given, Buffer.from(pw));
  if (!pw) return res.status(500).send(adm.loginPage('ADMIN_PASSWORD n’est pas configuré sur le serveur.'));
  if (!ok) { await new Promise((r) => setTimeout(r, 600)); return res.status(401).send(adm.loginPage('Mot de passe incorrect.')); }
  const exp = Date.now() + 30 * 24 * 3600 * 1000;
  const secure = req.secure ? '; Secure' : '';
  res.set('Set-Cookie', `${COOKIE}=${exp}.${sign('admin:' + exp)}; Path=/; Max-Age=${30 * 24 * 3600}; HttpOnly; SameSite=Lax${secure}`);
  res.redirect('/admin');
});
app.get('/admin/logout', (req, res) => { res.set('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0`); res.redirect('/admin/login'); });

app.use('/admin', requireAdmin);

// ---------- Commandes ----------
function orderFilters(query) {
  const where = [], params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replace('?', '$' + params.length)); };
  if (query.periode === 'today') where.push("created_at >= date_trunc('day', now())");
  else if (query.periode === '7' || query.periode === '30') add("created_at >= now() - (? || ' days')::interval", query.periode);
  if (query.produit) add('product_id = ?', parseInt(query.produit, 10) || 0);
  if (query.statut) add('status = ?', query.statut);
  if (query.q) {
    params.push('%' + query.q.trim() + '%');
    const n = '$' + params.length;
    where.push(`(customer_name ILIKE ${n} OR phone ILIKE ${n} OR city ILIKE ${n} OR address ILIKE ${n} OR id::text = ${'$' + (params.push(query.q.trim().replace(/^#/, '')), params.length)})`);
  }
  return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', params };
}

app.get('/admin', async (req, res, next) => {
  try {
    const s = await db.getSettings();
    const filters = { periode: req.query.periode || '', produit: req.query.produit || '', statut: req.query.statut || '', q: req.query.q || '' };
    const f = orderFilters(filters);
    const [orders, agg, prods] = await Promise.all([
      db.q(`SELECT * FROM orders ${f.sql} ORDER BY created_at DESC LIMIT 300`, f.params),
      db.q(`SELECT status, count(*)::int AS n, coalesce(sum(total),0)::bigint AS sum FROM orders ${orderFilters({ ...filters, statut: '' }).sql} GROUP BY status`, orderFilters({ ...filters, statut: '' }).params),
      db.q('SELECT id, name FROM products ORDER BY id'),
    ]);
    const by = Object.fromEntries(STATUSES.map((x) => [x.key, { n: 0, sum: 0 }]));
    for (const r of agg.rows) by[r.status] = { n: r.n, sum: Number(r.sum) };
    const total = Object.values(by).reduce((a, x) => a + x.n, 0);
    const confirmed = by.confirmee.n + by.expediee.n + by.livree.n + by.retour.n;
    const treated = total - by.nouvelle.n;
    const pct = (a, b) => (b ? Math.round((a / b) * 100) + ' %' : '—');
    const stats = {
      total,
      nouvelle: by.nouvelle.n,
      confRate: pct(confirmed, treated),
      delivRate: pct(by.livree.n, by.livree.n + by.retour.n),
      pending: by.confirmee.sum + by.expediee.sum,
      revenue: by.livree.sum,
    };
    const shownTotal = filters.statut ? (by[filters.statut] || { n: 0 }).n : total;
    res.send(adm.layout('Commandes', 'orders', adm.ordersPage({ orders: orders.rows, stats, products: prods.rows, filters, settings: s, total: shownTotal }), readFlash(req, res)));
  } catch (e) { next(e); }
});

app.post('/admin/commandes/:id/statut', async (req, res, next) => {
  try {
    if (STATUSES.some((x) => x.key === req.body.status)) {
      await db.q('UPDATE orders SET status = $1, updated_at = now() WHERE id = $2', [req.body.status, req.params.id]);
    }
    const back = String(req.body.back || '').replace(/[^\w=&%+.-]/g, '');
    res.redirect('/admin' + (back ? '?' + back : ''));
  } catch (e) { next(e); }
});

app.get('/admin/commandes.csv', async (req, res, next) => {
  try {
    const f = orderFilters(req.query);
    const { rows } = await db.q(`SELECT * FROM orders ${f.sql} ORDER BY created_at DESC`, f.params);
    const cell = (v) => {
      let t = String(v ?? '');
      if (/^[=+\-@]/.test(t)) t = "'" + t; // évite les formules dans Excel
      return '"' + t.replace(/"/g, '""') + '"';
    };
    const head = ['N°', 'Date', 'Client', 'Téléphone', 'Ville', 'Adresse', 'Produit', 'Offre', 'Quantité', 'Total', 'Statut', 'Note'];
    const lines = rows.map((o) => [o.id, new Date(o.created_at).toLocaleString('fr-FR', { timeZone: process.env.TIMEZONE || 'Africa/Abidjan' }), o.customer_name, o.phone, o.city, o.address, o.product_name, o.offer_label, o.quantity, o.total, (STATUSES.find((x) => x.key === o.status) || {}).label, o.note].map(cell).join(';'));
    res.set('Content-Type', 'text/csv; charset=utf-8').set('Content-Disposition', `attachment; filename="commandes-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('﻿' + [head.map(cell).join(';'), ...lines].join('\r\n'));
  } catch (e) { next(e); }
});

// ---------- Produits ----------
function productFromForm(b) {
  const lines = (t) => String(t || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const offers = lines(b.offers).map((l) => {
    const [label, qty, price, badge] = l.split('|').map((x) => (x || '').trim());
    return { label, qty: Math.max(1, parseInt(qty, 10) || 1), price: Math.max(0, parseInt(String(price).replace(/\D/g, ''), 10) || 0), badge: badge || '' };
  }).filter((o) => o.label);
  const faq = lines(b.faq).map((l) => { const i = l.indexOf('|'); return i > 0 ? { q: l.slice(0, i).trim(), a: l.slice(i + 1).trim() } : null; }).filter(Boolean);
  const cp = parseInt(String(b.compare_price || '').replace(/\D/g, ''), 10);
  return {
    name: String(b.name || '').trim().slice(0, 120),
    slug: slugify(b.slug || b.name),
    headline: String(b.headline || '').trim(),
    subheadline: String(b.subheadline || '').trim(),
    description: String(b.description || '').trim(),
    accent: /^#[0-9a-f]{6}$/i.test(b.accent) ? b.accent : '#ff5a1f',
    video_url: /^https?:\/\//.test(b.video_url || '') ? b.video_url.trim() : '',
    active: b.active === '1',
    benefits: lines(b.benefits),
    faq, offers,
    compare_price: Number.isFinite(cp) && cp > 0 ? cp : null,
  };
}

app.get('/admin/produits', async (req, res, next) => {
  try {
    const s = await db.getSettings();
    const { rows } = await db.q('SELECT p.*, (SELECT count(*) FROM orders o WHERE o.product_id = p.id)::int AS order_count FROM products p ORDER BY id');
    res.send(adm.layout('Produits', 'products', adm.productsPage(rows.map(parseProduct), s), readFlash(req, res)));
  } catch (e) { next(e); }
});

app.get('/admin/produits/nouveau', (req, res) =>
  res.send(adm.layout('Nouveau produit', 'products', adm.productForm({ offers: [{ label: '1 article', qty: 1, price: 10000 }, { label: '2 articles', qty: 2, price: 18000, badge: 'Meilleure offre' }] }, []))));

async function saveProduct(req, res, id) {
  const p = productFromForm(req.body);
  if (!p.name || !p.offers.length) {
    flash(res, 'Le nom et au moins une offre sont obligatoires.', true);
    return res.redirect(id ? `/admin/produits/${id}` : '/admin/produits/nouveau');
  }
  const vals = [p.name, p.slug, p.headline, p.subheadline, p.description, p.accent, p.video_url, p.active, JSON.stringify(p.benefits), JSON.stringify(p.faq), JSON.stringify(p.offers), p.compare_price];
  try {
    if (id) {
      await db.q(`UPDATE products SET name=$1, slug=$2, headline=$3, subheadline=$4, description=$5, accent=$6, video_url=$7, active=$8, benefits=$9, faq=$10, offers=$11, compare_price=$12 WHERE id=$13`, [...vals, id]);
    } else {
      const r = await db.q(`INSERT INTO products (name, slug, headline, subheadline, description, accent, video_url, active, benefits, faq, offers, compare_price) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`, vals);
      id = r.rows[0].id;
    }
  } catch (e) {
    if (e.code === '23505') { flash(res, 'Cette adresse de page est déjà utilisée par un autre produit.', true); return res.redirect(id ? `/admin/produits/${id}` : '/admin/produits/nouveau'); }
    throw e;
  }
  flash(res, 'Produit enregistré ✅');
  res.redirect(`/admin/produits/${id}`);
}
app.post('/admin/produits/nouveau', (req, res, next) => saveProduct(req, res, null).catch(next));
app.post('/admin/produits/:id', (req, res, next) => saveProduct(req, res, parseInt(req.params.id, 10)).catch(next));

app.get('/admin/produits/:id', async (req, res, next) => {
  try {
    const { rows } = await db.q('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.redirect('/admin/produits');
    const p = parseProduct(rows[0]);
    res.send(adm.layout(p.name, 'products', adm.productForm(p, p.image_ids), readFlash(req, res)));
  } catch (e) { next(e); }
});

app.post('/admin/produits/:id/photos', upload.array('photos', 10), async (req, res, next) => {
  try {
    const ids = [];
    for (const f of req.files || []) {
      const r = await db.q('INSERT INTO images (mime, data) VALUES ($1, $2) RETURNING id', [f.mimetype, f.buffer]);
      ids.push(r.rows[0].id);
    }
    await db.q('UPDATE products SET image_ids = image_ids || $1::jsonb WHERE id = $2', [JSON.stringify(ids), req.params.id]);
    flash(res, ids.length ? `${ids.length} photo(s) ajoutée(s) ✅` : 'Aucune image valide (JPG, PNG, WEBP, max 5 Mo).', !ids.length);
    res.redirect(`/admin/produits/${req.params.id}`);
  } catch (e) { next(e); }
});

app.post('/admin/produits/:id/photos/:img/supprimer', async (req, res, next) => {
  try {
    const img = parseInt(req.params.img, 10);
    await db.q(`UPDATE products SET image_ids = coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(image_ids) x WHERE x::int <> $1), '[]'::jsonb) WHERE id = $2`, [img, req.params.id]);
    await db.q('DELETE FROM images WHERE id = $1', [img]);
    res.redirect(`/admin/produits/${req.params.id}`);
  } catch (e) { next(e); }
});

app.post('/admin/produits/:id/supprimer', async (req, res, next) => {
  try {
    const { rows } = await db.q('DELETE FROM products WHERE id = $1 RETURNING image_ids', [req.params.id]);
    if (rows[0]) await db.q('DELETE FROM images WHERE id = ANY($1::int[])', [rows[0].image_ids || []]);
    flash(res, 'Produit supprimé.');
    res.redirect('/admin/produits');
  } catch (e) { next(e); }
});

// ---------- Paramètres ----------
app.get('/admin/parametres', async (req, res, next) => {
  try {
    const s = await db.getSettings();
    res.send(adm.layout('Paramètres', 'settings', adm.settingsPage(s, { resend: !!process.env.RESEND_API_KEY, to: process.env.ORDER_EMAIL }), readFlash(req, res)));
  } catch (e) { next(e); }
});
app.post('/admin/parametres', async (req, res, next) => {
  try { await db.saveSettings(req.body); flash(res, 'Paramètres enregistrés ✅'); res.redirect('/admin/parametres'); } catch (e) { next(e); }
});
app.post('/admin/test-email', async (req, res, next) => {
  try {
    const s = await db.getSettings();
    const r = await sendOrderEmail({ id: 0, product_name: 'TEST', offer_label: 'Email de test', quantity: 1, total: 0, customer_name: 'Client Test', phone: '0000000000', city: 'Test', address: '', note: '' }, s);
    flash(res, r.ok ? 'Email de test envoyé ✅ Vérifiez votre boîte (et les spams).' : `Échec : ${r.skipped ? 'RESEND_API_KEY ou ORDER_EMAIL manquant' : r.error}`, !r.ok);
    res.redirect('/admin/parametres');
  } catch (e) { next(e); }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Erreur serveur. Réessayez dans un instant.');
});

const PORT = process.env.PORT || 3000;
(async () => {
  await db.init();
  await seed();
  app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
})().catch((e) => { console.error('Démarrage impossible :', e); process.exit(1); });
