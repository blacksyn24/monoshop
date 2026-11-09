(function () {
  var S = window.Shop, esc = S.esc, money = S.money;
  var app = document.getElementById('app');
  var slug = (location.pathname.match(/^\/p\/([a-z0-9-]+)/) || [])[1] || new URLSearchParams(location.search).get('p');

  var ERRORS = {
    champs_invalides: 'Merci de remplir tous les champs obligatoires (*) avec un numéro de téléphone valide.',
    trop_de_commandes: 'Trop de commandes en peu de temps. Réessayez dans quelques minutes.',
    produit_introuvable: 'Ce produit n’est plus disponible.',
  };

  function notFound() {
    document.title = 'Produit introuvable';
    app.innerHTML = '<div class="loading"><h1>Produit introuvable</h1><p><a href="/">Voir la boutique</a></p></div>';
  }

  Promise.all([
    slug ? S.api('products?select=*&slug=eq.' + encodeURIComponent(slug) + '&active=eq.true') : Promise.resolve([]),
    S.settings(),
  ]).then(function (res) {
    var p = res[0] && res[0][0], s = res[1];
    document.getElementById('store').textContent = s.store_name;
    document.getElementById('delivery').textContent = s.delivery_text;
    document.getElementById('foot').textContent = '© ' + new Date().getFullYear() + ' ' + s.store_name + (s.country ? ' — ' + s.country : '');
    if (!p) return notFound();
    render(p, s);
  }).catch(function () {
    app.innerHTML = '<div class="loading">Connexion impossible. <a href="">Réessayer</a></div>';
  });

  function render(p, s) {
    var cur = s.currency;
    var offers = p.offers && p.offers.length ? p.offers : [{ label: '1 article', qty: 1, price: 0 }];
    var first = offers[0];
    var defIdx = offers.length > 1 ? 1 : 0;
    var images = p.images || [];
    var save = p.compare_price && p.compare_price > first.price ? Math.round((1 - first.price / p.compare_price) * 100) : 0;

    document.title = p.name + ' — ' + s.store_name;
    document.documentElement.style.setProperty('--accent', p.accent);
    var meta = document.createElement('meta'); meta.name = 'theme-color'; meta.content = p.accent; document.head.appendChild(meta);
    var d = document.createElement('meta'); d.name = 'description'; d.content = p.subheadline; document.head.appendChild(d);

    var gallery = images.length
      ? '<div class="gal-main"><img id="mainimg" src="' + esc(images[0]) + '" alt="' + esc(p.name) + '"></div>' +
        (images.length > 1 ? '<div class="thumbs">' + images.map(function (u, i) { return '<img src="' + esc(u) + '" class="' + (i === 0 ? 'on' : '') + '" alt="">'; }).join('') + '</div>' : '')
      : '<div class="gal-main noimg"><span>📷<br>Ajoutez les photos du produit<br>dans le dashboard</span></div>';

    var offerCards = offers.map(function (o, i) {
      var cmp = p.compare_price ? p.compare_price * o.qty : 0;
      return '<label class="offer"><input type="radio" name="offer" value="' + i + '" data-price="' + o.price + '"' + (i === defIdx ? ' checked' : '') + '>' +
        '<span class="o-body">' + (o.badge ? '<span class="badge">' + esc(o.badge) + '</span>' : '') +
        '<span class="o-label">' + esc(o.label) + '</span>' +
        '<span class="o-price">' + money(o.price, cur) + (cmp > o.price ? ' <s>' + money(cmp, cur) + '</s>' : '') + '</span></span></label>';
    }).join('');

    var wa = S.waNumber(s.whatsapp);
    var svc = p.kind === 'service';
    if (svc) document.getElementById('topbar').textContent = '🎓 Vous payez seulement à la livraison de votre présentation';

    var trust = svc
      ? '<div><span>💵</span>Payé à la livraison</div><div><span>⚡</span>Livré en 72 h</div><div><span>✏️</span>Retouches incluses</div>'
      : '<div><span>💵</span>Paiement à la livraison</div><div><span>🚚</span>Livraison rapide</div><div><span>📞</span>Service client</div>';

    var fields = svc
      ? '<div class="f"><label for="n">Nom complet *</label><input id="n" name="name" required maxlength="80" autocomplete="name"></div>' +
        '<div class="f"><label for="t">Numéro WhatsApp *</label><input id="t" name="phone" type="tel" required maxlength="20" inputmode="tel" autocomplete="tel"></div>' +
        '<div class="f"><label for="ec">École / Université *</label><input id="ec" name="ecole" required maxlength="120"></div>' +
        '<div class="f"><label for="nv">Niveau *</label><select id="nv" name="niveau" required><option value="">Choisir…</option><option>BTS</option><option>Licence</option><option>Master</option><option>Doctorat</option><option>Rapport de stage</option><option>Autre</option></select></div>' +
        '<div class="f"><label for="th">Thème du mémoire *</label><input id="th" name="theme" required maxlength="200"></div>' +
        '<div class="f"><label for="sd">Date de soutenance</label><input id="sd" name="soutenance" type="date"></div>' +
        '<div class="f"><label for="v">Ville *</label><input id="v" name="city" required maxlength="60" autocomplete="address-level2"></div>' +
        '<input type="hidden" name="address" value="">'
      : '<div class="f"><label for="n">Nom complet *</label><input id="n" name="name" required maxlength="80" autocomplete="name"></div>' +
        '<div class="f"><label for="t">Téléphone (WhatsApp) *</label><input id="t" name="phone" type="tel" required maxlength="20" inputmode="tel" autocomplete="tel"></div>' +
        '<div class="f"><label for="v">Ville *</label><input id="v" name="city" required maxlength="60" autocomplete="address-level2"></div>' +
        '<div class="f"><label for="a">Quartier / adresse de livraison</label><input id="a" name="address" maxlength="160" autocomplete="street-address"></div>';

    var steps = svc
      ? '<div><b>1</b><br><strong>Vous commandez</strong><br>Choisissez votre formule en 1 minute.</div>' +
        '<div><b>2</b><br><strong>Envoyez votre mémoire</strong><br>Sur WhatsApp, avec votre numéro de commande.</div>' +
        '<div><b>3</b><br><strong>Recevez et payez</strong><br>Vous validez l’aperçu, vous payez, vous recevez le fichier final.</div>'
      : '<div><b>1</b><br><strong>Vous commandez</strong><br>Remplissez le formulaire en 30 secondes.</div>' +
        '<div><b>2</b><br><strong>On vous appelle</strong><br>Nous confirmons votre commande et l’adresse.</div>' +
        '<div><b>3</b><br><strong>Vous payez à la réception</strong><br>Payez en espèces quand vous recevez le colis.</div>';

    app.innerHTML =
      '<div class="hero"><div>' + gallery + '</div><div>' +
        '<h1>' + esc(p.name) + '</h1>' +
        '<p class="headline">' + esc(p.headline) + '</p>' +
        '<p class="sub">' + esc(p.subheadline) + '</p>' +
        '<div class="price"><b>' + money(first.price, cur) + '</b>' + (p.compare_price > first.price ? '<s>' + money(p.compare_price, cur) + '</s>' : '') + (save ? '<span class="save">-' + save + '%</span>' : '') + '</div>' +
        '<div class="trust">' + trust + '</div>' +
        '<form class="card" id="commander" novalidate>' +
          '<h2>Commander maintenant</h2><p class="hint">' + (svc ? 'Remplissez le formulaire, puis envoyez votre mémoire sur WhatsApp.' : 'Remplissez le formulaire, nous vous appelons pour confirmer.') + '</p>' + offerCards +
          fields +
          '<div class="f"><label for="nt">Note (facultatif)</label><textarea id="nt" name="note" rows="2" maxlength="300"></textarea></div>' +
          '<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
          '<div id="ferr"></div>' +
          '<div class="total"><span>Total à payer à la livraison</span><span id="tot">' + money(offers[defIdx].price, cur) + '</span></div>' +
          '<button class="btn" type="submit" id="sub">✅ Je commande — paiement à la livraison</button>' +
          '<p class="cod">🔒 ' + (svc ? 'Aucun paiement à l’avance. Vous payez après avoir validé l’aperçu de votre présentation.' : 'Aucun paiement en ligne. Vous payez en espèces à la réception.') + '</p>' +
        '</form>' +
      '</div></div>' +
      (p.video_url ? '<section class="block"><video src="' + esc(p.video_url) + '" controls playsinline preload="metadata"></video></section>' : '') +
      ((p.benefits || []).length ? '<section class="block"><h2>Pourquoi vous allez l’adorer</h2><ul class="benefits">' + p.benefits.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></section>' : '') +
      (p.description ? '<section class="block desc"><h2>Description</h2>' + p.description.split(/\n\s*\n/).map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') + '</section>' : '') +
      (images.length > 1 ? '<section class="block gallery">' + images.slice(1).map(function (u) { return '<img src="' + esc(u) + '" alt="" loading="lazy">'; }).join('') + '</section>' : '') +
      '<section class="block"><h2>Comment ça marche ?</h2><div class="steps">' + steps + '</div></section>' +
      ((p.faq || []).length ? '<section class="block"><h2>Questions fréquentes</h2>' + p.faq.map(function (f) { return '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>'; }).join('') + '</section>' : '') +
      '<section class="block"><a class="btn" href="#commander">Commander maintenant</a></section>' +
      '<div class="sticky" id="sticky"><a class="btn" href="#commander">Commander — ' + money(offers[defIdx].price, cur) + '</a></div>' +
      (wa ? '<a class="wa" href="https://wa.me/' + wa + '?text=' + encodeURIComponent('Bonjour, je suis intéressé(e) par : ' + p.name) + '" target="_blank" rel="noopener" aria-label="WhatsApp"><svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.7 1.2 1.6 2 1.1 1 2 1.3 2.3 1.4.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.2z"/></svg></a>' : '');

    S.pixels(s,
      ['ViewContent', { content_name: p.name, value: first.price, currency: s.currency_code }],
      ['ViewContent', { content_name: p.name, value: first.price, currency: s.currency_code }]);

    // Interactions
    var tot = document.getElementById('tot'), sticky = document.getElementById('sticky'), form = document.getElementById('commander');
    form.querySelectorAll('input[name=offer]').forEach(function (r) {
      r.addEventListener('change', function () {
        tot.textContent = money(+r.dataset.price, cur);
        sticky.querySelector('a').textContent = 'Commander — ' + money(+r.dataset.price, cur);
      });
    });
    app.querySelectorAll('.thumbs img').forEach(function (t) {
      t.addEventListener('click', function () {
        document.getElementById('mainimg').src = t.src;
        app.querySelectorAll('.thumbs img').forEach(function (x) { x.classList.remove('on'); });
        t.classList.add('on');
      });
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { sticky.classList.toggle('hide', e[0].isIntersecting); }, { threshold: 0.1 }).observe(form);
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = form.elements, ferr = document.getElementById('ferr'), btn = document.getElementById('sub');
      ferr.innerHTML = '';
      if (f.website.value) return; // robot
      var name = f.name.value.trim(), phone = f.phone.value.trim(), city = f.city.value.trim();
      var extra = svc ? { ecole: f.ecole.value.trim(), niveau: f.niveau.value, theme: f.theme.value.trim(), soutenance: f.soutenance.value } : {};
      if (!name || !city || phone.replace(/\D/g, '').length < 8 || (svc && (!extra.ecole || !extra.niveau || !extra.theme))) {
        ferr.innerHTML = '<div class="err">' + ERRORS.champs_invalides + '</div>';
        return;
      }
      btn.disabled = true; btn.textContent = 'Envoi en cours…';
      S.api('rpc/place_order', {
        method: 'POST',
        body: { p_slug: p.slug, p_offer: +form.querySelector('input[name=offer]:checked').value, p_name: name, p_phone: phone, p_city: city, p_address: f.address.value, p_note: f.note.value, p_extra: extra },
      }).then(function (r) {
        location.href = '/merci?id=' + r.id + '&t=' + r.token;
      }).catch(function (e) {
        var key = Object.keys(ERRORS).find(function (k) { return String(e.message).indexOf(k) >= 0; });
        ferr.innerHTML = '<div class="err">' + (key ? ERRORS[key] : 'La commande n’a pas pu être envoyée. Vérifiez votre connexion et réessayez.') + '</div>';
        btn.disabled = false; btn.textContent = '✅ Je commande — paiement à la livraison';
      });
    });
  }
})();
