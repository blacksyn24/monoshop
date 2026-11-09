const { q } = require('./db');

// Produits de départ — tous les textes et prix sont modifiables dans le dashboard.
const PRODUCTS = [
  {
    slug: 'appareil-photo-enfant',
    name: 'Appareil Photo Magique pour Enfants',
    accent: '#2f6fed',
    headline: 'Le cadeau de Noël qui imprime les photos en 2 secondes 📸',
    subheadline:
      'Votre enfant prend une photo… et elle sort imprimée instantanément ! Sans encre, sans téléphone, des heures de jeu créatif.',
    description:
      "Offrez à votre enfant son tout premier appareil photo. Il prend des photos et des vidéos, et imprime ses photos préférées instantanément sur du papier thermique — sans encre ni cartouche.\n\nIl peut ensuite colorier ses photos avec les feutres fournis, les coller dans sa chambre ou les offrir à la famille. Un cadeau qui éloigne les enfants des écrans et réveille leur créativité.",
    benefits: [
      'Impression instantanée sans encre (papier thermique)',
      'Prend des photos ET des vidéos',
      'Écran couleur, très simple à utiliser dès 3 ans',
      'Batterie rechargeable par câble USB',
      'Livré avec rouleaux de papier, feutres et cordon',
      'Coque solide, résistante aux chutes',
    ],
    faq: [
      { q: 'Faut-il de l’encre ?', a: 'Non. L’appareil imprime sur du papier thermique, sans encre ni cartouche.' },
      { q: 'Le papier est-il inclus ?', a: 'Oui, des rouleaux sont fournis. Des rouleaux supplémentaires sont disponibles.' },
      { q: 'À partir de quel âge ?', a: 'Dès 3 ans. Les boutons sont gros et simples.' },
      { q: 'Comment je paie ?', a: 'Vous payez en espèces à la livraison, après avoir reçu votre colis.' },
    ],
    offers: [
      { label: '1 appareil photo', qty: 1, price: 19900, badge: '' },
      { label: '2 appareils photo (frère & sœur)', qty: 2, price: 35900, badge: 'Le plus choisi' },
    ],
    compare_price: 29900,
  },
  {
    slug: 'lampes-led-sans-fil',
    name: 'Lampes LED Sans Fil avec Télécommande (lot de 3)',
    accent: '#f5a400',
    headline: 'Fini le noir pendant les coupures de courant 💡',
    subheadline:
      '3 lampes LED qui se collent partout en 10 secondes. Sans fil, sans électricien, contrôlées avec une télécommande.',
    description:
      "Collez-les sous les placards de la cuisine, dans la chambre, le couloir, l’armoire ou les escaliers. Elles fonctionnent avec des piles : même pendant une coupure de courant, vous gardez la lumière.\n\nAvec la télécommande, allumez ou éteignez les 3 lampes en même temps, réglez l’intensité ou programmez l’extinction automatique après 30 minutes.",
    benefits: [
      'Fonctionne avec des piles : lumière même pendant les coupures',
      'Se colle partout en 10 secondes (adhésif fourni)',
      'Télécommande : allumer, éteindre, régler l’intensité',
      'Minuterie : extinction automatique après 30 min',
      'Lumière LED puissante et économique',
      'Idéal cuisine, chambre, armoire, couloir',
    ],
    faq: [
      { q: 'Les piles sont-elles incluses ?', a: 'Les lampes fonctionnent avec des piles AAA. Précisez à la confirmation si vous voulez qu’on vous les fournisse.' },
      { q: 'Faut-il percer le mur ?', a: 'Non, un adhésif double face est fourni. Pas besoin d’outils ni d’électricien.' },
      { q: 'Combien de lampes dans un lot ?', a: '3 lampes + 1 télécommande.' },
      { q: 'Comment je paie ?', a: 'Vous payez en espèces à la livraison, après avoir reçu votre colis.' },
    ],
    offers: [
      { label: '1 lot (3 lampes + télécommande)', qty: 1, price: 9900, badge: '' },
      { label: '2 lots (6 lampes + 2 télécommandes)', qty: 2, price: 16900, badge: 'Meilleure offre' },
    ],
    compare_price: 14900,
  },
];

async function seed() {
  const { rows } = await q('SELECT count(*)::int AS n FROM products');
  if (rows[0].n > 0) return;
  for (const p of PRODUCTS) {
    await q(
      `INSERT INTO products (slug, name, accent, headline, subheadline, description, benefits, faq, offers, compare_price)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [p.slug, p.name, p.accent, p.headline, p.subheadline, p.description,
        JSON.stringify(p.benefits), JSON.stringify(p.faq), JSON.stringify(p.offers), p.compare_price]
    );
  }
  console.log('[seed] 2 produits de départ créés');
}

module.exports = { seed };
