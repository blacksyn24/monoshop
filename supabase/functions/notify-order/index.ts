// Envoie un email (via Resend) à chaque nouvelle commande.
// Appelée par un déclencheur de la base (pg_net) avec { id }.
// Sécurité : la fonction relit la commande en base et ne l'envoie qu'une seule fois (colonne notified_at),
// donc un appel extérieur ne peut rien envoyer d'autre qu'une vraie commande pas encore notifiée.
import { createClient } from "jsr:@supabase/supabase-js@2";

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n: number, cur: string) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " " + cur;

Deno.serve(async (req) => {
  try {
    const { id } = await req.json().catch(() => ({ id: null }));
    if (!Number.isInteger(id)) return new Response("id manquant", { status: 400 });

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Secrets : variables de la fonction, sinon coffre-fort Vault de la base
    const secret = async (env: string, vault: string) =>
      Deno.env.get(env) || (await db.rpc("app_secret", { p_name: vault })).data || "";
    const RESEND_API_KEY = await secret("RESEND_API_KEY", "resend_api_key");
    const ORDER_EMAIL = await secret("ORDER_EMAIL", "order_email");
    if (!RESEND_API_KEY || !ORDER_EMAIL) return new Response("email non configuré", { status: 200 });

    // On "réserve" la commande : une seule notification par commande
    const { data: rows } = await db.from("orders").update({ notified_at: new Date().toISOString() })
      .eq("id", id).is("notified_at", null).select("*");
    const o = rows?.[0];
    if (!o) return new Response("déjà notifiée ou introuvable", { status: 200 });

    const { data: st } = await db.from("settings").select("key,value");
    const s: Record<string, string> = { store_name: "Ma Boutique", currency: "FCFA" };
    (st || []).forEach((r: { key: string; value: string }) => (s[r.key] = r.value));

    const ex = o.extra || {};
    const row = (k: string, v: string) =>
      `<tr><td style="padding:6px 14px 6px 0;color:#666;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 0;font-weight:600">${v}</td></tr>`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
      <h2 style="margin:0 0 4px">🛒 Nouvelle commande #${o.id}</h2>
      <p style="margin:0 0 16px;color:#666">${esc(o.product_name)} — à confirmer rapidement</p>
      <table style="border-collapse:collapse;font-size:15px">
        ${row("Client", esc(o.customer_name))}
        ${row("Téléphone", `<a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>`)}
        ${row("Ville", esc(o.city))}
        ${o.address ? row("Adresse", esc(o.address)) : ""}
        ${row("Offre", esc(o.offer_label))}
        ${row("Total à encaisser", money(o.total, s.currency))}
        ${ex.ecole ? row("École", esc(ex.ecole)) : ""}
        ${ex.niveau ? row("Niveau", esc(ex.niveau)) : ""}
        ${ex.theme ? row("Thème", esc(ex.theme)) : ""}
        ${ex.soutenance ? row("Soutenance", esc(ex.soutenance)) : ""}
        ${o.note ? row("Note", esc(o.note)) : ""}
      </table>
      <p style="margin-top:22px"><a href="https://monoshop.pages.dev/admin/" style="background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Ouvrir le dashboard</a></p>
    </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("EMAIL_FROM") || `${s.store_name} <onboarding@resend.dev>`,
        to: ORDER_EMAIL.split(",").map((x) => x.trim()).filter(Boolean),
        subject: `🛒 Commande #${o.id} — ${o.product_name} — ${money(o.total, s.currency)} — ${o.city}`,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      await db.from("orders").update({ notified_at: null }).eq("id", id); // permet un nouvel essai
      console.error("Resend", res.status, body);
      return new Response("échec Resend : " + body, { status: 502 });
    }
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response("erreur", { status: 500 });
  }
});
