const { Pool } = require('pg');

const useSsl = process.env.PGSSL === 'true';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 5,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS images (
  id SERIAL PRIMARY KEY,
  mime TEXT NOT NULL,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  accent TEXT NOT NULL DEFAULT '#ff5a1f',
  headline TEXT NOT NULL DEFAULT '',
  subheadline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  benefits JSONB NOT NULL DEFAULT '[]',
  faq JSONB NOT NULL DEFAULT '[]',
  offers JSONB NOT NULL DEFAULT '[]',
  compare_price INTEGER,
  image_ids JSONB NOT NULL DEFAULT '[]',
  video_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  offer_label TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  total INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'nouvelle',
  admin_note TEXT NOT NULL DEFAULT '',
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
`;

async function init() {
  await pool.query(SCHEMA);
}

const q = (text, params) => pool.query(text, params);

const DEFAULT_SETTINGS = {
  store_name: 'Ma Boutique',
  currency: 'FCFA',
  currency_code: 'XOF',
  country: '',
  phone_prefix: '225',
  whatsapp: '',
  delivery_text: 'Livraison rapide partout dans le pays',
  fb_pixel_id: '',
  tiktok_pixel_id: '',
};

async function getSettings() {
  const { rows } = await q('SELECT key, value FROM settings');
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.value;
  return s;
}

async function saveSettings(obj) {
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (obj[key] === undefined) continue;
    await q(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      [key, String(obj[key]).trim()]
    );
  }
}

module.exports = { pool, q, init, getSettings, saveSettings, DEFAULT_SETTINGS };
