const { esc, money } = require('./util');

function pixels(s, events) {
  let out = '';
  if (s.fb_pixel_id) {
    out += `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(s.fb_pixel_id)});fbq('track','PageView');${events.fb || ''}</script>`;
  }
  if (s.tiktok_pixel_id) {
    out += `<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load(${JSON.stringify(s.tiktok_pixel_id)});ttq.page();${events.tt || ''}}(window,document,'ttq');</script>`;
  }
  return out;
}

const BASE_CSS = `
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1a1a1a;background:#f6f5f2;line-height:1.5}
a{color:inherit}img{max-width:100%;display:block}
.wrap{max-width:1040px;margin:0 auto;padding:0 16px}
.topbar{background:#111;color:#fff;text-align:center;font-size:13px;padding:8px 12px;font-weight:600}
header.brand{background:#fff;border-bottom:1px solid #eee}
header.brand .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:56px}
header.brand span{text-align:right}@media(max-width:480px){header.brand span{display:none}}
header.brand b{font-size:18px;letter-spacing:-.3px}
.btn{display:inline-block;background:var(--accent);color:#fff;border:0;border-radius:12px;padding:16px 20px;font-size:17px;font-weight:800;cursor:pointer;text-decoration:none;text-align:center;width:100%;box-shadow:0 6px 18px -6px var(--accent)}
.btn:active{transform:translateY(1px)}
`;

function productPage(p, s, images) {
  const cur = s.currency;
  const offers = p.offers.length ? p.offers : [{ label: '1 article', qty: 1, price: 0 }];
  const first = offers[0];
  const save = p.compare_price && p.compare_price > first.price ? Math.round((1 - first.price / p.compare_price) * 100) : 0;
  const wa = s.whatsapp ? `https://wa.me/${esc(s.whatsapp.replace(/\D/g, ''))}?text=${encodeURIComponent('Bonjour, je suis intéressé(e) par : ' + p.name)}` : '';

  const gallery = images.length
    ? `<div class="gal-main"><img id="mainimg" src="/img/${images[0]}" alt="${esc(p.name)}"></div>
       ${images.length > 1 ? `<div class="thumbs">${images.map((id, i) => `<img src="/img/${id}" data-i="${i}" class="${i === 0 ? 'on' : ''}" alt="">`).join('')}</div>` : ''}`
    : `<div class="gal-main noimg"><span>📷<br>Ajoutez les photos du produit<br>dans le dashboard</span></div>`;

  const offerCards = offers
    .map((o, i) => {
      const unitCompare = p.compare_price ? p.compare_price * o.qty : 0;
      return `<label class="offer">
        <input type="radio" name="offer" value="${i}" data-price="${o.price}" ${i === (offers.length > 1 ? 1 : 0) ? 'checked' : ''}>
        <span class="o-body">
          ${o.badge ? `<span class="badge">${esc(o.badge)}</span>` : ''}
          <span class="o-label">${esc(o.label)}</span>
          <span class="o-price">${money(o.price, cur)} ${unitCompare > o.price ? `<s>${money(unitCompare, cur)}</s>` : ''}</span>
        </span></label>`;
    })
    .join('');

  const defaultOffer = offers[offers.length > 1 ? 1 : 0];

  return `<!doctype html><html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.name)} — ${esc(s.store_name)}</title>
<meta name="description" content="${esc(p.subheadline)}">
<meta property="og:title" content="${esc(p.name)}"><meta property="og:description" content="${esc(p.headline)}">
${images[0] ? `<meta property="og:image" content="/img/${images[0]}">` : ''}
<meta name="theme-color" content="${esc(p.accent)}">
<style>${BASE_CSS}
:root{--accent:${esc(p.accent)}}
.hero{display:grid;gap:28px;padding:20px 0 8px}
@media(min-width:860px){.hero{grid-template-columns:1.05fr 1fr;padding-top:32px}}
.gal-main{background:#fff;border-radius:18px;overflow:hidden;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center}
.gal-main img{width:100%;height:100%;object-fit:cover}
.noimg{border:2px dashed #ccc;color:#888;text-align:center;font-weight:600}
.thumbs{display:flex;gap:8px;margin-top:10px;overflow-x:auto}
.thumbs img{width:68px;height:68px;object-fit:cover;border-radius:10px;cursor:pointer;opacity:.6;border:2px solid transparent}
.thumbs img.on{opacity:1;border-color:var(--accent)}
h1{font-size:clamp(24px,4.4vw,34px);line-height:1.15;margin:0 0 10px;letter-spacing:-.5px}
.headline{font-size:18px;font-weight:700;margin:0 0 8px}
.sub{color:#555;margin:0 0 16px}
.price{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.price b{font-size:30px;color:var(--accent)}.price s{color:#999;font-size:18px}
.save{background:#111;color:#fff;font-size:13px;font-weight:700;padding:4px 10px;border-radius:99px}
.trust{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 18px}
.trust div{background:#fff;border-radius:12px;padding:10px 6px;text-align:center;font-size:12.5px;font-weight:600}
.trust span{display:block;font-size:20px}
.card{background:#fff;border-radius:18px;padding:18px;box-shadow:0 2px 0 rgba(0,0,0,.03)}
#commander h2{margin:0 0 4px;font-size:21px}#commander .hint{margin:0 0 14px;color:#666;font-size:14px}
.offer{display:block;margin-bottom:10px;cursor:pointer}
.offer input{position:absolute;opacity:0}
.o-body{display:flex;flex-direction:column;gap:2px;border:2px solid #e5e5e5;border-radius:14px;padding:12px 14px;position:relative}
.offer input:checked+.o-body{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 7%,#fff)}
.offer input:focus-visible+.o-body{outline:3px solid #111}
.o-label{font-weight:700}.o-price{font-weight:800;color:var(--accent)}.o-price s{color:#999;font-weight:500;margin-left:6px}
.badge{position:absolute;top:-10px;right:12px;background:var(--accent);color:#fff;font-size:11.5px;font-weight:800;padding:2px 10px;border-radius:99px}
.f{margin-bottom:10px}.f label{display:block;font-size:14px;font-weight:600;margin-bottom:4px}
.f input,.f textarea{width:100%;font:inherit;font-size:16px;padding:13px 14px;border:1.5px solid #ddd;border-radius:12px;background:#fff}
.f input:focus,.f textarea:focus{outline:none;border-color:var(--accent)}
.total{display:flex;justify-content:space-between;font-weight:800;font-size:18px;margin:14px 0}
.cod{text-align:center;font-size:13px;color:#555;margin:10px 0 0}
.hp{position:absolute;left:-9999px}
section.block{padding:28px 0}
section.block h2{font-size:24px;margin:0 0 16px;letter-spacing:-.3px}
.benefits{list-style:none;padding:0;margin:0;display:grid;gap:10px}
@media(min-width:700px){.benefits{grid-template-columns:1fr 1fr}}
.benefits li{background:#fff;border-radius:14px;padding:14px 14px 14px 46px;position:relative;font-weight:600}
.benefits li:before{content:"✓";position:absolute;left:14px;top:12px;width:22px;height:22px;border-radius:50%;background:var(--accent);color:#fff;text-align:center;line-height:22px;font-size:13px}
.desc p{margin:0 0 12px;font-size:16.5px}
.steps{display:grid;gap:10px}@media(min-width:700px){.steps{grid-template-columns:repeat(3,1fr)}}
.steps div{background:#fff;border-radius:14px;padding:16px}.steps b{display:inline-flex;width:30px;height:30px;border-radius:50%;background:#111;color:#fff;align-items:center;justify-content:center;margin-bottom:6px}
details{background:#fff;border-radius:14px;padding:14px 16px;margin-bottom:8px}summary{font-weight:700;cursor:pointer}
video{width:100%;border-radius:18px;background:#000}
footer{padding:30px 0 110px;text-align:center;color:#777;font-size:13px}
.sticky{position:fixed;left:0;right:0;bottom:0;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.95);backdrop-filter:blur(6px);border-top:1px solid #eee;z-index:10;transition:transform .2s}
.sticky.hide{transform:translateY(110%)}
@media(min-width:860px){.sticky{display:none}footer{padding-bottom:30px}}
.wa{position:fixed;right:16px;bottom:86px;width:54px;height:54px;border-radius:50%;background:#25d366;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(0,0,0,.25);z-index:11}
@media(min-width:860px){.wa{bottom:24px}}
</style>
${pixels(s, {
  fb: `fbq('track','ViewContent',{content_name:${JSON.stringify(p.name)},value:${first.price},currency:${JSON.stringify(s.currency_code)}});`,
  tt: `ttq.track('ViewContent',{content_name:${JSON.stringify(p.name)},value:${first.price},currency:${JSON.stringify(s.currency_code)}});`,
})}
</head><body>
<div class="topbar">🚚 Paiement à la livraison — vous payez seulement à la réception</div>
<header class="brand"><div class="wrap"><b>${esc(s.store_name)}</b><span style="font-size:13px;color:#666">${esc(s.delivery_text)}</span></div></header>

<main class="wrap">
  <div class="hero">
    <div>${gallery}</div>
    <div>
      <h1>${esc(p.name)}</h1>
      <p class="headline">${esc(p.headline)}</p>
      <p class="sub">${esc(p.subheadline)}</p>
      <div class="price"><b>${money(first.price, cur)}</b>${p.compare_price > first.price ? `<s>${money(p.compare_price, cur)}</s>` : ''}${save ? `<span class="save">-${save}%</span>` : ''}</div>
      <div class="trust">
        <div><span>💵</span>Paiement à la livraison</div>
        <div><span>🚚</span>Livraison rapide</div>
        <div><span>📞</span>Service client</div>
      </div>

      <form class="card" id="commander" method="post" action="/p/${esc(p.slug)}/commande" autocomplete="on">
        <h2>Commander maintenant</h2>
        <p class="hint">Remplissez le formulaire, nous vous appelons pour confirmer.</p>
        ${offerCards}
        <div class="f"><label for="n">Nom complet *</label><input id="n" name="name" required maxlength="80" autocomplete="name"></div>
        <div class="f"><label for="t">Téléphone (WhatsApp) *</label><input id="t" name="phone" type="tel" required minlength="8" maxlength="20" inputmode="tel" autocomplete="tel" pattern="[+0-9 ().-]{8,20}"></div>
        <div class="f"><label for="v">Ville *</label><input id="v" name="city" required maxlength="60" autocomplete="address-level2"></div>
        <div class="f"><label for="a">Quartier / adresse de livraison</label><input id="a" name="address" maxlength="160" autocomplete="street-address"></div>
        <div class="f"><label for="nt">Note (facultatif)</label><textarea id="nt" name="note" rows="2" maxlength="300"></textarea></div>
        <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="total"><span>Total à payer à la livraison</span><span id="tot">${money(defaultOffer.price, cur)}</span></div>
        <button class="btn" type="submit" id="sub">✅ Je commande — paiement à la livraison</button>
        <p class="cod">🔒 Aucun paiement en ligne. Vous payez en espèces à la réception.</p>
      </form>
    </div>
  </div>

  ${p.video_url ? `<section class="block"><video src="${esc(p.video_url)}" controls playsinline preload="metadata"></video></section>` : ''}

  ${p.benefits.length ? `<section class="block"><h2>Pourquoi vous allez l’adorer</h2><ul class="benefits">${p.benefits.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></section>` : ''}

  ${p.description ? `<section class="block desc"><h2>Description</h2>${p.description.split(/\n\s*\n/).map((para) => `<p>${esc(para)}</p>`).join('')}</section>` : ''}

  ${images.length > 1 ? `<section class="block"><div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">${images.slice(1).map((id) => `<img src="/img/${id}" alt="" loading="lazy" style="border-radius:14px;width:100%;aspect-ratio:1;object-fit:cover">`).join('')}</div></section>` : ''}

  <section class="block"><h2>Comment ça marche ?</h2><div class="steps">
    <div><b>1</b><br><strong>Vous commandez</strong><br>Remplissez le formulaire en 30 secondes.</div>
    <div><b>2</b><br><strong>On vous appelle</strong><br>Nous confirmons votre commande et l’adresse.</div>
    <div><b>3</b><br><strong>Vous payez à la réception</strong><br>Payez en espèces quand vous recevez le colis.</div>
  </div></section>

  ${p.faq.length ? `<section class="block"><h2>Questions fréquentes</h2>${p.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</section>` : ''}

  <section class="block"><a class="btn" href="#commander">Commander maintenant</a></section>
</main>
<footer>© ${new Date().getFullYear()} ${esc(s.store_name)}${s.country ? ' — ' + esc(s.country) : ''}</footer>

<div class="sticky" id="sticky"><a class="btn" href="#commander">Commander — ${money(defaultOffer.price, cur)}</a></div>
${wa ? `<a class="wa" href="${wa}" target="_blank" rel="noopener" aria-label="WhatsApp"><svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.7 1.2 1.6 2 1.1 1 2 1.3 2.3 1.4.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.2z"/></svg></a>` : ''}
<script>
(function(){
  var cur=${JSON.stringify(cur)};
  function fmt(n){return String(Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g,' ')+' '+cur}
  var tot=document.getElementById('tot'),sticky=document.getElementById('sticky'),form=document.getElementById('commander');
  document.querySelectorAll('input[name=offer]').forEach(function(r){r.addEventListener('change',function(){tot.textContent=fmt(+r.dataset.price);sticky.querySelector('a').textContent='Commander — '+fmt(+r.dataset.price)})});
  document.querySelectorAll('.thumbs img').forEach(function(t){t.addEventListener('click',function(){document.getElementById('mainimg').src=t.src;document.querySelectorAll('.thumbs img').forEach(function(x){x.classList.remove('on')});t.classList.add('on')})});
  if('IntersectionObserver' in window){new IntersectionObserver(function(e){sticky.classList.toggle('hide',e[0].isIntersecting)},{threshold:.1}).observe(form)}
  form.addEventListener('submit',function(){var b=document.getElementById('sub');setTimeout(function(){b.disabled=true;b.textContent='Envoi en cours…'},0)});
})();
</script>
</body></html>`;
}

function thanksPage(order, p, s) {
  const accent = p ? p.accent : '#16a34a';
  const ev = `{value:${order.total},currency:${JSON.stringify(s.currency_code)},content_name:${JSON.stringify(order.product_name)}}`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Merci pour votre commande — ${esc(s.store_name)}</title><meta name="robots" content="noindex">
<style>${BASE_CSS}:root{--accent:${esc(accent)}}.box{max-width:520px;margin:40px auto;background:#fff;border-radius:20px;padding:28px;text-align:center}
.box h1{margin:8px 0}.recap{text-align:left;background:#f6f5f2;border-radius:14px;padding:14px 16px;margin:18px 0}.recap div{display:flex;justify-content:space-between;gap:12px;padding:4px 0}</style>
${pixels(s, { fb: `fbq('track','Purchase',${ev});`, tt: `ttq.track('PlaceAnOrder',${ev});` })}
</head><body><div class="topbar">🚚 Paiement à la livraison</div><div class="wrap"><div class="box">
<div style="font-size:56px">🎉</div>
<h1>Merci ${esc(order.customer_name.split(' ')[0])} !</h1>
<p>Votre commande <b>#${order.id}</b> est bien enregistrée.<br><b>Nous allons vous appeler très bientôt</b> au <b>${esc(order.phone)}</b> pour confirmer la livraison.</p>
<div class="recap"><div><span>Produit</span><b>${esc(order.product_name)}</b></div><div><span>Offre</span><b>${esc(order.offer_label)}</b></div><div><span>À payer à la livraison</span><b>${money(order.total, s.currency)}</b></div></div>
<p style="color:#666;font-size:14px">Gardez votre téléphone allumé 📱 — sans confirmation, nous ne pouvons pas expédier.</p>
${s.whatsapp ? `<a class="btn" style="background:#25d366;box-shadow:none" href="https://wa.me/${esc(s.whatsapp.replace(/\D/g, ''))}?text=${encodeURIComponent(`Bonjour, je confirme ma commande #${order.id} (${order.product_name}).`)}">Confirmer sur WhatsApp</a>` : ''}
</div></div></body></html>`;
}

function homePage(products, s) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(s.store_name)}</title><style>${BASE_CSS}:root{--accent:#111}.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));padding:24px 0}
.grid a{background:#fff;border-radius:16px;overflow:hidden;text-decoration:none}.grid .im{aspect-ratio:1;background:#eee;display:flex;align-items:center;justify-content:center;font-size:40px}.grid .im img{width:100%;height:100%;object-fit:cover}.grid b{display:block;padding:12px 14px}</style>
</head><body><div class="topbar">🚚 Paiement à la livraison</div><header class="brand"><div class="wrap"><b>${esc(s.store_name)}</b></div></header>
<main class="wrap"><div class="grid">${products
    .map((p) => `<a href="/p/${esc(p.slug)}"><div class="im">${p.image_ids[0] ? `<img src="/img/${p.image_ids[0]}" alt="">` : '🛍️'}</div><b>${esc(p.name)}</b></a>`)
    .join('') || '<p>Bientôt disponible.</p>'}</div></main></body></html>`;
}

function notFound(s) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Introuvable</title><style>${BASE_CSS}</style></head>
<body><div class="wrap" style="text-align:center;padding:80px 16px"><h1>Page introuvable</h1><p><a href="/">Retour à ${esc(s.store_name)}</a></p></div></body></html>`;
}

module.exports = { productPage, thanksPage, homePage, notFound };
