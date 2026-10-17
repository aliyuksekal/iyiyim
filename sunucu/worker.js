// İyiyim sunucusu — Cloudflare Worker + D1 + Firebase Cloud Messaging (v1)
// Gerekenler (Cloudflare panelinden):
//   D1 bağlantısı adı:  DB
//   Gizli değişken:     FCM_HESAP  -> Firebase hizmet hesabı JSON dosyasının tamamı
// Tablolar ilk istekte kendiliğinden kurulur.

const SORU_ARASI_MS = 30 * 60 * 1000;      // aynı kişiye 30 dakikada bir soru
const DAVET_SURESI_MS = 24 * 60 * 60 * 1000; // davet kodu 24 saat geçerli
const KOD_HARFLERI = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CEVAPLAR = ["iyi", "sonra", "yardim"];
const HERKESE_ARASI_MS = 10 * 60 * 1000;   // herkese bildirim 10 dakikada bir
const SAKLAMA_MS = 30 * 24 * 60 * 60 * 1000; // soru kayıtları 30 gün saklanır

const SEMA = [
  `CREATE TABLE IF NOT EXISTS kullanicilar (id TEXT PRIMARY KEY, sifre_ozet TEXT NOT NULL, ad TEXT NOT NULL, token TEXT, olusma INTEGER NOT NULL, durum TEXT, durum_zamani INTEGER)`,
  `CREATE TABLE IF NOT EXISTS davetler (kod TEXT PRIMARY KEY, kullanici TEXT NOT NULL, bitis INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS baglar (a TEXT NOT NULL, b TEXT NOT NULL, olusma INTEGER NOT NULL, PRIMARY KEY (a, b))`,
  `CREATE TABLE IF NOT EXISTS sorular (id TEXT PRIMARY KEY, kimden TEXT NOT NULL, kime TEXT NOT NULL, zaman INTEGER NOT NULL, cevap TEXT, cevap_zamani INTEGER)`,
  `CREATE INDEX IF NOT EXISTS sorular_cift ON sorular (kimden, kime, zaman)`,
  `CREATE INDEX IF NOT EXISTS sorular_kime ON sorular (kime, zaman)`,
];
let semaHazir = false;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Id, X-Sifre",
  "Access-Control-Max-Age": "86400",
};

function json(veri, durum = 200) {
  return new Response(JSON.stringify(veri), {
    status: durum,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}
const hata = (mesaj, durum = 400, ek = {}) => json({ hata: mesaj, ...ek }, durum);

export default {
  async fetch(istek, env, ctx) {
    if (istek.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    try {
      if (!semaHazir) {
        await env.DB.batch(SEMA.map((s) => env.DB.prepare(s)));
        semaHazir = true;
      }
      const yol = new URL(istek.url).pathname.replace(/\/+$/, "") || "/";
      const govde = istek.method === "POST" ? await istek.json().catch(() => ({})) : {};

      if (yol === "/" ) return json({ uygulama: "iyiyim", durum: "calisiyor" });
      if (Math.random() < 0.02) ctx.waitUntil(temizlik(env));
      if (yol === "/kayit" && istek.method === "POST") return kayit(env, govde);

      const ben = await kimlikDogrula(env, istek);
      if (!ben) return hata("Kimlik doğrulanamadı", 401);

      switch (`${istek.method} ${yol}`) {
        case "POST /guncelle": return guncelle(env, ben, govde);
        case "POST /davet": return davetOlustur(env, ben);
        case "POST /katil": return katil(env, ctx, ben, govde);
        case "GET /kisiler": return kisiler(env, ben);
        case "POST /sor": return sor(env, ben, govde);
        case "POST /cevap": return cevap(env, ben, govde);
        case "POST /herkese": return herkese(env, ctx, ben, govde);
        case "POST /deneme": return deneme(env, ctx, ben, govde);
        case "POST /kisi-sil": return kisiSil(env, ben, govde);
        case "POST /hesap-sil": return hesapSil(env, ben);
      }
      return hata("Bulunamadı", 404);
    } catch (e) {
      console.error(e && e.stack ? e.stack : e);
      return hata("Sunucu hatası", 500);
    }
  },
};

// ---------- yardımcılar ----------
function rastgeleHex(bayt) {
  const a = new Uint8Array(bayt);
  crypto.getRandomValues(a);
  return [...a].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function ozet(metin) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(metin));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function temizAd(ad) {
  return String(ad || "").replace(/\s+/g, " ").trim().slice(0, 40);
}
async function kimlikDogrula(env, istek) {
  const id = istek.headers.get("X-Id");
  const sifre = istek.headers.get("X-Sifre");
  if (!id || !sifre) return null;
  const k = await env.DB.prepare("SELECT * FROM kullanicilar WHERE id = ?").bind(id).first();
  if (!k) return null;
  return k.sifre_ozet === (await ozet(sifre)) ? k : null;
}
async function bagliMi(env, a, b) {
  return !!(await env.DB.prepare("SELECT 1 FROM baglar WHERE a = ? AND b = ?").bind(a, b).first());
}

// ---------- uç noktalar ----------
async function kayit(env, g) {
  const ad = temizAd(g.ad);
  if (!ad) return hata("Ad gerekli");
  const id = crypto.randomUUID();
  const sifre = rastgeleHex(32);
  await env.DB.prepare("INSERT INTO kullanicilar (id, sifre_ozet, ad, token, olusma) VALUES (?, ?, ?, ?, ?)")
    .bind(id, await ozet(sifre), ad, g.token || null, Date.now()).run();
  return json({ id, sifre, ad });
}

async function guncelle(env, ben, g) {
  const ad = g.ad !== undefined ? temizAd(g.ad) : ben.ad;
  const token = g.token !== undefined ? (g.token || null) : ben.token;
  if (!ad) return hata("Ad boş olamaz");
  await env.DB.prepare("UPDATE kullanicilar SET ad = ?, token = ? WHERE id = ?").bind(ad, token, ben.id).run();
  return json({ tamam: true, ad });
}

async function davetOlustur(env, ben) {
  await env.DB.prepare("DELETE FROM davetler WHERE kullanici = ? OR bitis < ?").bind(ben.id, Date.now()).run();
  for (let deneme = 0; deneme < 6; deneme++) {
    const a = new Uint8Array(6);
    crypto.getRandomValues(a);
    const kod = [...a].map((x) => KOD_HARFLERI[x % KOD_HARFLERI.length]).join("");
    const bitis = Date.now() + DAVET_SURESI_MS;
    const r = await env.DB.prepare("INSERT OR IGNORE INTO davetler (kod, kullanici, bitis) VALUES (?, ?, ?)")
      .bind(kod, ben.id, bitis).run();
    if (r.meta && r.meta.changes) return json({ kod, bitis });
  }
  return hata("Kod üretilemedi, tekrar dene", 500);
}

async function katil(env, ctx, ben, g) {
  const kod = String(g.kod || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (kod.length !== 6) return hata("Kod 6 karakter olmalı");
  const d = await env.DB.prepare("SELECT * FROM davetler WHERE kod = ?").bind(kod).first();
  if (!d || d.bitis < Date.now()) return hata("Bu kod geçersiz ya da süresi dolmuş", 404);
  if (d.kullanici === ben.id) return hata("Bu senin kendi kodun");
  const o = await env.DB.prepare("SELECT id, ad, token FROM kullanicilar WHERE id = ?").bind(d.kullanici).first();
  if (!o) return hata("Kodun sahibi bulunamadı", 404);
  const simdi = Date.now();
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO baglar (a, b, olusma) VALUES (?, ?, ?)").bind(ben.id, o.id, simdi),
    env.DB.prepare("INSERT OR IGNORE INTO baglar (a, b, olusma) VALUES (?, ?, ?)").bind(o.id, ben.id, simdi),
    env.DB.prepare("DELETE FROM davetler WHERE kod = ?").bind(kod),
  ]);
  ctx.waitUntil(bildirimGonder(env, o, { tip: "eklendi", kimden: ben.id, ad: ben.ad }, 86400));
  return json({ kisi: { id: o.id, ad: o.ad } });
}

async function kisiler(env, ben) {
  const liste = await env.DB.prepare(
    "SELECT u.id, u.ad, u.durum, u.durum_zamani, p.olusma FROM baglar p JOIN kullanicilar u ON u.id = p.b WHERE p.a = ? ORDER BY p.olusma"
  ).bind(ben.id).all();
  const sonuc = [];
  const alti = Date.now() - 6 * 60 * 60 * 1000;
  for (const k of liste.results || []) {
    const [benden, ondan] = await env.DB.batch([
      env.DB.prepare("SELECT id, zaman, cevap, cevap_zamani FROM sorular WHERE kimden = ? AND kime = ? ORDER BY zaman DESC LIMIT 1").bind(ben.id, k.id),
      env.DB.prepare("SELECT id, zaman FROM sorular WHERE kimden = ? AND kime = ? AND cevap IS NULL AND zaman > ? ORDER BY zaman DESC LIMIT 1").bind(k.id, ben.id, alti),
    ]);
    sonuc.push({
      id: k.id,
      ad: k.ad,
      sonSoru: (benden.results && benden.results[0]) || null,
      bekleyenSoru: (ondan.results && ondan.results[0]) || null,
      sonDurum: k.durum ? { cevap: k.durum, zaman: k.durum_zamani } : null,
    });
  }
  return json({ ben: { id: ben.id, ad: ben.ad }, kisiler: sonuc, simdi: Date.now(), soruArasi: SORU_ARASI_MS });
}

async function sor(env, ben, g) {
  const kime = String(g.kime || "");
  if (!(await bagliMi(env, ben.id, kime))) return hata("Bu kişi listende yok", 404);
  const son = await env.DB.prepare("SELECT zaman FROM sorular WHERE kimden = ? AND kime = ? ORDER BY zaman DESC LIMIT 1")
    .bind(ben.id, kime).first();
  const simdi = Date.now();
  if (son && simdi - son.zaman < SORU_ARASI_MS) {
    return hata("Aynı kişiye 30 dakikada bir sorabilirsin", 429, { kalan: SORU_ARASI_MS - (simdi - son.zaman) });
  }
  const o = await env.DB.prepare("SELECT id, ad, token FROM kullanicilar WHERE id = ?").bind(kime).first();
  const soruId = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO sorular (id, kimden, kime, zaman) VALUES (?, ?, ?, ?)")
    .bind(soruId, ben.id, kime, simdi).run();
  const ulasti = await bildirimGonder(env, o, { tip: "soru", soruId, kimden: ben.id, ad: ben.ad, zaman: String(simdi) }, 3600);
  return json({ soruId, zaman: simdi, ulasti });
}

async function cevap(env, ben, g) {
  const c = String(g.cevap || "");
  if (!CEVAPLAR.includes(c)) return hata("Geçersiz cevap");
  const s = await env.DB.prepare("SELECT * FROM sorular WHERE id = ? AND kime = ?").bind(String(g.soruId || ""), ben.id).first();
  if (!s) return hata("Soru bulunamadı", 404);
  const simdi = Date.now();
  await env.DB.prepare("UPDATE sorular SET cevap = ?, cevap_zamani = ? WHERE id = ?").bind(c, simdi, s.id).run();
  const soran = await env.DB.prepare("SELECT id, ad, token FROM kullanicilar WHERE id = ?").bind(s.kimden).first();
  const ulasti = await bildirimGonder(env, soran, { tip: "cevap", soruId: s.id, kimden: ben.id, ad: ben.ad, cevap: c }, 86400);
  return json({ tamam: true, ulasti });
}

async function herkese(env, ctx, ben, g) {
  const c = String(g.cevap || "iyi");
  if (!CEVAPLAR.includes(c)) return hata("Geçersiz durum");
  const simdi = Date.now();
  if (ben.durum_zamani && simdi - ben.durum_zamani < HERKESE_ARASI_MS) {
    return hata("Herkese 10 dakikada bir bildirebilirsin", 429, { kalan: HERKESE_ARASI_MS - (simdi - ben.durum_zamani) });
  }
  const alti = simdi - 6 * 60 * 60 * 1000;
  await env.DB.batch([
    env.DB.prepare("UPDATE kullanicilar SET durum = ?, durum_zamani = ? WHERE id = ?").bind(c, simdi, ben.id),
    // Bana sorulmuş ve henüz cevaplamadığım sorular da bu durumla cevaplanmış sayılır
    env.DB.prepare("UPDATE sorular SET cevap = ?, cevap_zamani = ? WHERE kime = ? AND cevap IS NULL AND zaman > ?").bind(c, simdi, ben.id, alti),
  ]);
  const liste = await env.DB.prepare(
    "SELECT u.id, u.ad, u.token FROM baglar p JOIN kullanicilar u ON u.id = p.b WHERE p.a = ?"
  ).bind(ben.id).all();
  const kisiler = liste.results || [];
  const sonuclar = await Promise.all(kisiler.map((k) =>
    bildirimGonder(env, k, { tip: "durum", kimden: ben.id, ad: ben.ad, cevap: c, zaman: String(simdi) }, 86400)
  ));
  return json({ tamam: true, kisi: kisiler.length, ulasan: sonuclar.filter(Boolean).length });
}

async function temizlik(env) {
  const simdi = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sorular WHERE zaman < ?").bind(simdi - SAKLAMA_MS),
    env.DB.prepare("DELETE FROM davetler WHERE bitis < ?").bind(simdi),
  ]);
}

async function kisiSil(env, ben, g) {
  const id = String(g.id || "");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM baglar WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)").bind(ben.id, id, id, ben.id),
  ]);
  return json({ tamam: true });
}

async function hesapSil(env, ben) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM baglar WHERE a = ? OR b = ?").bind(ben.id, ben.id),
    env.DB.prepare("DELETE FROM davetler WHERE kullanici = ?").bind(ben.id),
    env.DB.prepare("DELETE FROM sorular WHERE kimden = ? OR kime = ?").bind(ben.id, ben.id),
    env.DB.prepare("DELETE FROM kullanicilar WHERE id = ?").bind(ben.id),
  ]);
  return json({ tamam: true });
}

// ---------- Firebase Cloud Messaging ----------
let googleErisim = null;
let googleBitis = 0;

function b64url(bayt) {
  let s = "";
  for (const x of bayt) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function pemdenBayt(pem) {
  const b = atob(pem.replace(/\\n/g, "").replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""));
  const a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return a.buffer;
}

async function googleJetonu(hesap) {
  if (googleErisim && Date.now() < googleBitis - 60000) return googleErisim;
  const simdi = Math.floor(Date.now() / 1000);
  const kodla = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const imzasiz = kodla({ alg: "RS256", typ: "JWT" }) + "." + kodla({
    iss: hesap.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: simdi,
    exp: simdi + 3600,
  });
  const anahtar = await crypto.subtle.importKey(
    "pkcs8", pemdenBayt(hesap.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const imza = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", anahtar, new TextEncoder().encode(imzasiz));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + imzasiz + "." + b64url(new Uint8Array(imza)),
  });
  const v = await r.json();
  if (!v.access_token) throw new Error("Google jetonu alınamadı: " + JSON.stringify(v));
  googleErisim = v.access_token;
  googleBitis = Date.now() + (v.expires_in || 3600) * 1000;
  return googleErisim;
}

/** FCM_HESAP'ı okur ve doğrular. Sorun varsa { hata } döner. */
function hesapOku(env) {
  if (!env.FCM_HESAP) return { hata: "Sunucuda FCM_HESAP gizli değişkeni yok" };
  let hesap;
  try {
    hesap = JSON.parse(env.FCM_HESAP);
  } catch (e) {
    return { hata: "FCM_HESAP geçerli bir JSON değil (eksik ya da bozuk kopyalanmış olabilir)" };
  }
  if (hesap && hesap.project_info) {
    return { hata: "FCM_HESAP'a yanlış dosya yapıştırılmış: bu google-services.json. Firebase > Proje ayarları > Hizmet hesapları > Yeni özel anahtar oluştur dosyası gerekli" };
  }
  if (!hesap || hesap.type !== "service_account" || !hesap.private_key || !hesap.client_email || !hesap.project_id) {
    return { hata: "FCM_HESAP hizmet hesabı dosyası değil ya da eksik (private_key / client_email yok)" };
  }
  return { hesap };
}

/** Tek bir FCM gönderimi; ayrıntılı sonuç döner. */
async function fcmIstek(env, hesap, token, veri, omurSaniye) {
  const metin = {};
  for (const [k, v] of Object.entries(veri)) metin[k] = String(v);
  try {
    const jeton = await googleJetonu(hesap);
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${hesap.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: "Bearer " + jeton, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: { token, data: metin, android: { priority: "HIGH", ttl: omurSaniye + "s" } },
      }),
    });
    if (r.ok) return { ok: true, durum: r.status, metin: "" };
    return { ok: false, durum: r.status, metin: await r.text() };
  } catch (e) {
    return { ok: false, durum: 0, metin: (e && e.message) || String(e) };
  }
}

async function bildirimGonder(env, kullanici, veri, omurSaniye) {
  if (!kullanici || !kullanici.token) return false;
  const { hesap, hata } = hesapOku(env);
  if (hata) {
    console.error("Bildirim gönderilemedi:", hata);
    return false;
  }
  const s = await fcmIstek(env, hesap, kullanici.token, veri, omurSaniye);
  if (s.ok) return true;
  console.error("FCM hatası", s.durum, s.metin);
  if (s.durum === 404 || s.metin.includes("UNREGISTERED")) {
    await env.DB.prepare("UPDATE kullanicilar SET token = NULL WHERE id = ?").bind(kullanici.id).run();
  }
  return false;
}

/** Ayarlar > Bildirimleri dene: zincirin her halkasını tek tek kontrol eder. */
async function deneme(env, ctx, ben, g) {
  const rapor = { jeton: !!ben.token, proje: null, gonderim: null, ok: false };
  const { hesap, hata } = hesapOku(env);
  if (hata) return json({ ...rapor, gonderim: hata });
  rapor.proje = hesap.project_id;
  if (!ben.token) return json({ ...rapor, gonderim: "Bu telefonun bildirim jetonu sunucuya ulaşmamış" });
  const veri = { tip: "deneme", ad: ben.ad };
  const gecikme = Math.min(Math.max(parseInt(g.gecikme || 0, 10) || 0, 0), 25);
  if (gecikme > 0) {
    // Önce bağlantıyı doğrula, sonra gerçek denemeyi gecikmeli gönder (uygulama kapalıyken test için)
    try { await googleJetonu(hesap); } catch (e) { return json({ ...rapor, gonderim: "Google girişi başarısız: " + e.message }); }
    ctx.waitUntil(new Promise((r) => setTimeout(r, gecikme * 1000)).then(() => fcmIstek(env, hesap, ben.token, { ...veri, gecikmeli: "1" }, 600)));
    return json({ ...rapor, ok: true, gonderim: `${gecikme} saniye sonra gönderilecek` });
  }
  const s = await fcmIstek(env, hesap, ben.token, veri, 600);
  if (s.ok) return json({ ...rapor, ok: true, gonderim: "Gönderildi" });
  if (s.durum === 404 || s.metin.includes("UNREGISTERED")) {
    await env.DB.prepare("UPDATE kullanicilar SET token = NULL WHERE id = ?").bind(ben.id).run();
  }
  let aciklama = `FCM ${s.durum}: ${s.metin.slice(0, 400)}`;
  if (s.metin.includes("SENDER_ID_MISMATCH")) aciklama = "Sunucudaki anahtar ile uygulamadaki Firebase projesi farklı (SENDER_ID_MISMATCH)";
  else if (s.metin.includes("invalid_grant") || s.metin.includes("Invalid JWT")) aciklama = "Hizmet hesabı anahtarı geçersiz ya da silinmiş (invalid_grant). Yeni anahtar oluşturup FCM_HESAP'a yapıştır";
  else if (s.durum === 403 || s.metin.includes("PERMISSION_DENIED")) aciklama = "Firebase Cloud Messaging API kapalı ya da izin yok (403). Firebase > Proje ayarları > Cloud Messaging'de V1 API'yi etkinleştir";
  else if (s.metin.includes("UNREGISTERED") || s.durum === 404) aciklama = "Telefonun bildirim jetonu geçersiz. Uygulamayı kapatıp açınca yenilenir";
  return json({ ...rapor, gonderim: aciklama });
}
