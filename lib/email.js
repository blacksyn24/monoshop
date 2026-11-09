const { esc, money } = require('./util');

// Envoi via l'API HTTP de Resend (le plan gratuit de Render bloque le SMTP).
async function sendOrderEmail(order, settings) {
  const to = process.env.ORDER_EMAIL;
  const key = process.env.RESEND_API_KEY;
  if (!to || !key) {
    console.log(`[email] non configuré (RESEND_API_KEY / ORDER_EMAIL) — commande #${order.id} non envoyée par email`);
    return { ok: false, skipped: true };
  }
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const cur = settings.currency;
  const row = (k, v) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap">${k}</td><td style="padding:6px 0;font-weight:600">${v}</td></tr>`;
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
    <h2 style="margin:0 0 4px">🛒 Nouvelle commande #${order.id}</h2>
    <p style="margin:0 0 16px;color:#666">${esc(order.product_name)} — à confirmer par téléphone</p>
    <table style="border-collapse:collapse;font-size:15px">
      ${row('Client', esc(order.customer_name))}
      ${row('Téléphone', `<a href="tel:${esc(order.phone)}">${esc(order.phone)}</a>`)}
      ${row('Ville', esc(order.city))}
      ${row('Adresse', esc(order.address) || '—')}
      ${row('Offre', esc(order.offer_label))}
      ${row('Quantité', order.quantity)}
      ${row('Total à encaisser', money(order.total, cur))}
      ${order.note ? row('Note', esc(order.note)) : ''}
    </table>
    ${base ? `<p style="margin-top:20px"><a href="${base}/admin" style="background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Ouvrir le dashboard</a></p>` : ''}
  </div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || `${settings.store_name} <onboarding@resend.dev>`,
        to: to.split(',').map((s) => s.trim()).filter(Boolean),
        subject: `🛒 Commande #${order.id} — ${order.product_name} — ${money(order.total, cur)} — ${order.city}`,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] échec ${res.status}: ${body}`);
      return { ok: false, error: `${res.status} ${body}` };
    }
    return { ok: true };
  } catch (e) {
    console.error('[email] erreur', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { sendOrderEmail };
