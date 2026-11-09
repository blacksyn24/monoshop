(function () {
  var C = window.SHOP_CONFIG;
  var H = { apikey: C.supabaseKey, 'Content-Type': 'application/json' };

  function api(path, opts) {
    opts = opts || {};
    return fetch(C.supabaseUrl + '/rest/v1/' + path, {
      method: opts.method || 'GET',
      headers: H,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      return r.text().then(function (t) {
        var data = t ? JSON.parse(t) : null;
        if (!r.ok) {
          var err = new Error((data && data.message) || 'Erreur ' + r.status);
          err.status = r.status;
          throw err;
        }
        return data;
      });
    });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function money(n, cur) {
    return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ' + (cur || '');
  }

  var DEFAULTS = {
    store_name: 'Ma Boutique', currency: 'FCFA', currency_code: 'XOF', country: '',
    phone_prefix: '225', whatsapp: '', delivery_text: 'Livraison rapide partout dans le pays',
    fb_pixel_id: '', tiktok_pixel_id: '',
  };

  function settings() {
    return api('settings?select=key,value').then(function (rows) {
      var s = Object.assign({}, DEFAULTS);
      (rows || []).forEach(function (r) { s[r.key] = r.value; });
      return s;
    }).catch(function () { return Object.assign({}, DEFAULTS); });
  }

  // Pixels Facebook / TikTok (chargés seulement si un ID est renseigné)
  function pixels(s, fbEvent, ttEvent) {
    if (s.fb_pixel_id) {
      !function (f, b, e, v, n, t, x) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; x = b.getElementsByTagName(e)[0]; x.parentNode.insertBefore(t, x) }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', s.fb_pixel_id); fbq('track', 'PageView');
      if (fbEvent) fbq('track', fbEvent[0], fbEvent[1]);
    }
    if (s.tiktok_pixel_id) {
      !function (w, d, t) { w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || []; ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"], ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } }; for (var i = 0; i < ttq.methods.length; i++)ttq.setAndDefer(ttq, ttq.methods[i]); ttq.instance = function (t) { for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++)ttq.setAndDefer(e, ttq.methods[n]); return e }, ttq.load = function (e, n) { var i = "https://analytics.tiktok.com/i18n/pixel/events.js"; ttq._i = ttq._i || {}, ttq._i[e] = [], ttq._i[e]._u = i, ttq._t = ttq._t || {}, ttq._t[e] = +new Date, ttq._o = ttq._o || {}, ttq._o[e] = n || {}; var o = document.createElement("script"); o.type = "text/javascript", o.async = !0, o.src = i + "?sdkid=" + e + "&lib=" + t; var a = document.getElementsByTagName("script")[0]; a.parentNode.insertBefore(o, a) }; ttq.load(s.tiktok_pixel_id); ttq.page(); if (ttEvent) ttq.track(ttEvent[0], ttEvent[1]); }(window, document, 'ttq');
    }
  }

  function waNumber(n) { return String(n || '').replace(/\D/g, ''); }

  window.Shop = { api: api, esc: esc, money: money, settings: settings, pixels: pixels, waNumber: waNumber };
})();
