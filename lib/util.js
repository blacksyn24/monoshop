const crypto = require('crypto');

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const money = (n, currency) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ' + (currency || '');

const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const sign = (value) => crypto.createHmac('sha256', SECRET).update(String(value)).digest('hex').slice(0, 32);

// Numéro au format international (sans +) pour wa.me
function intlPhone(phone, prefix) {
  let p = String(phone || '').replace(/[^\d+]/g, '');
  if (p.startsWith('+')) return p.slice(1);
  if (p.startsWith('00')) return p.slice(2);
  if (prefix && p.startsWith(prefix) && p.length > prefix.length + 7) return p;
  p = p.replace(/^0+(?=\d{8})/, (m) => (prefix === '225' ? m : '')); // la Côte d'Ivoire garde le 0
  return (prefix || '') + p;
}

const STATUSES = [
  { key: 'nouvelle', label: 'Nouvelle', color: '#2563eb' },
  { key: 'injoignable', label: 'Injoignable', color: '#a16207' },
  { key: 'confirmee', label: 'Confirmée', color: '#7c3aed' },
  { key: 'expediee', label: 'Expédiée', color: '#0891b2' },
  { key: 'livree', label: 'Livrée / payée', color: '#16a34a' },
  { key: 'retour', label: 'Refusée / retour', color: '#dc2626' },
  { key: 'annulee', label: 'Annulée', color: '#6b7280' },
];
const statusOf = (key) => STATUSES.find((s) => s.key === key) || STATUSES[0];

const slugify = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'produit';

module.exports = { esc, money, sign, intlPhone, STATUSES, statusOf, slugify };
