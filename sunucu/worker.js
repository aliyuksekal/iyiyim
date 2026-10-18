// İyiyim sunucusu — Cloudflare Worker + D1 + Firebase Cloud Messaging (v1). GitHub Actions ile otomatik yayınlanır.
// Gerekenler (Cloudflare panelinden):
//   D1 bağlantısı adı:  DB
//   Gizli değişken:     FCM_HESAP  -> Firebase hizmet hesabı JSON dosyasının tamamı
//                        (aynı hesap Play Console'a davet edilir; ödemeler onunla Google'a doğrulatılır)
// Tablolar ilk istekte kendiliğinden kurulur.

const SUNUCU_SURUM = "1.8";
const GECMIS_MS = 24 * 60 * 60 * 1000;   // bildirim geçmişi 24 saat
const PAKET = "com.matali.iyiyim";
const URUN_TAM = "iyiyim_tam";
const URUN_HEDIYE = "iyiyim_hediye";       // ilk hediye: 79,99
const URUN_HEDIYE_IND = "iyiyim_hediye_49"; // 2. ve sonraki hediyeler: 49,99
const TASIMA_ARASI_MS = 3 * 24 * 60 * 60 * 1000; // bir satın alma 3 günde bir başka hesaba taşınabilir
const SORU_ARASI_MS = 0;                   // "İyi misin?" için bekleme süresi yok
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
  `CREATE TABLE IF NOT EXISTS satinalmalar (token TEXT PRIMARY KEY, urun TEXT NOT NULL, kullanici TEXT, olusma INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS hediyeler (kod TEXT PRIMARY KEY, veren TEXT NOT NULL, token TEXT NOT NULL, kullanan TEXT, olusma INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sinirlar (anahtar TEXT NOT NULL, zaman INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS sinirlar_anahtar ON sinirlar (anahtar, zaman)`,
  `CREATE TABLE IF NOT EXISTS ayarlar (ad TEXT PRIMARY KEY, deger TEXT)`,
  `CREATE TABLE IF NOT EXISTS durumlar (kimden TEXT NOT NULL, durum TEXT NOT NULL, zaman INTEGER NOT NULL, konum TEXT)`,
  `CREATE INDEX IF NOT EXISTS durumlar_kimden ON durumlar (kimden, zaman)`,
];
// Sonradan eklenen sütunlar (var olan veritabanlarında tek tek eklenir, varsa hata yutulur)
const EK_SUTUNLAR = [
  "ALTER TABLE sorular ADD COLUMN konum TEXT",
  "ALTER TABLE kullanicilar ADD COLUMN durum_konum TEXT",
  "ALTER TABLE satinalmalar ADD COLUMN iptal INTEGER DEFAULT 0",
  "ALTER TABLE satinalmalar ADD COLUMN siparis TEXT",
  "ALTER TABLE satinalmalar ADD COLUMN tasima INTEGER",
  "ALTER TABLE hediyeler ADD COLUMN iptal INTEGER DEFAULT 0",
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
      await semaKur(env);
      const yol = new URL(istek.url).pathname.replace(/\/+$/, "") || "/";
      const govde = istek.method === "POST" ? await istek.json().catch(() => ({})) : {};

      if (yol === "/" ) return json({ uygulama: "iyiyim", durum: "calisiyor", surum: SUNUCU_SURUM });
      if (Math.random() < 0.02) ctx.waitUntil(temizlik(env));
      const ip = istek.headers.get("CF-Connecting-IP") || "?";
      if (yol === "/kayit" && istek.method === "POST") {
        if (await sinirAsildi(env, "kayit:" + ip, 10, 60 * 60 * 1000, true)) return hata("Çok fazla deneme. Biraz sonra tekrar dene.", 429);
        return kayit(env, govde);
      }

      const ben = await kimlikDogrula(env, istek);
      if (!ben) return hata("Kimlik doğrulanamadı", 401);

      switch (`${istek.method} ${yol}`) {
        case "POST /guncelle": return guncelle(env, ben, govde);
        case "POST /davet": return davetOlustur(env, ben);
        case "POST /katil": return katil(env, ctx, ben, govde, ip);
        case "GET /kisiler": return kisiler(env, ben);
        case "POST /sor": return sor(env, ben, govde);
        case "POST /cevap": return cevap(env, ben, govde);
        case "POST /herkese": return herkese(env, ctx, ben, govde);
        case "POST /tam": return tamKaydet(env, ben, govde);
        case "POST /hediye": return hediyeVer(env, ctx, ben, govde);
        case "POST /hediye-kullan": return hediyeKullan(env, ctx, ben, govde, ip);
        case "GET /hediyelerim": return hediyelerim(env, ben);
        case "GET /gecmis": return gecmis(env, ben);
        case "POST /deneme":
          if (await sinirAsildi(env, "deneme:" + ben.id, 20, 3600000, true)) return hata("Çok fazla deneme. Biraz sonra tekrar dene.", 429);
          return deneme(env, ctx, ben, govde);
        case "POST /kisi-sil": return kisiSil(env, ben, govde);
        case "POST /hesap-sil": return hesapSil(env, ben);
      }
      return hata("Bulunamadı", 404);
    } catch (e) {
      console.error(e && e.stack ? e.stack : e);
      return hata("Sunucu hatası", 500);
    }
  },

  // Her gece: Google Play'de iade edilen / iptal olan satın almaları geri al
  async scheduled(olay, env, ctx) {
    ctx.waitUntil((async () => {
      await semaKur(env);
      await iadeleriIsle(env);
      await temizlik(env);
    })());
  },
};

async function semaKur(env) {
  if (semaHazir) return;
  await env.DB.batch(SEMA.map((s) => env.DB.prepare(s)));
  for (const a of EK_SUTUNLAR) {
    try { await env.DB.prepare(a).run(); } catch (e) { /* sütun zaten var */ }
  }
  // İyiyim Tam sütunu ilk kez eklenirse, o ana kadarki (test) kullanıcıları kalıcı Tam say
  let tamYeni = false;
  try {
    await env.DB.prepare("ALTER TABLE kullanicilar ADD COLUMN tam INTEGER DEFAULT 0").run();
    tamYeni = true;
  } catch (e) { /* zaten var */ }
  try { await env.DB.prepare("ALTER TABLE kullanicilar ADD COLUMN eski INTEGER DEFAULT 0").run(); } catch (e) { /* zaten var */ }
  if (tamYeni) await env.DB.prepare("UPDATE kullanicilar SET tam = 1, eski = 1").run();
  semaHazir = true;
}

/**
 * Basit sınırlayıcı: son `pencere` içinde `anahtar` için en fazla `adet` kayıt.
 * kaydet=true ise bu deneme de sayılır; false ise yalnızca bakılır (hatalı denemeler ayrıca yazılır).
 */
async function sinirAsildi(env, anahtar, adet, pencere, kaydet) {
  const simdi = Date.now();
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM sinirlar WHERE anahtar = ? AND zaman > ?").bind(anahtar, simdi - pencere).first();
  if (r && r.n >= adet) return true;
  if (kaydet) await env.DB.prepare("INSERT INTO sinirlar (anahtar, zaman) VALUES (?, ?)").bind(anahtar, simdi).run();
  return false;
}
async function hataliDeneme(env, ...anahtarlar) {
  const simdi = Date.now();
  await env.DB.batch(anahtarlar.map((a) => env.DB.prepare("INSERT INTO sinirlar (anahtar, zaman) VALUES (?, ?)").bind(a, simdi)));
}

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
  if (await sinirAsildi(env, "davet:" + ben.id, 30, 3600000, true)) return hata("Çok fazla deneme. Biraz sonra tekrar dene.", 429);
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

async function katil(env, ctx, ben, g, ip) {
  const kod = String(g.kod || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (kod.length !== 6) return hata("Kod 6 karakter olmalı");
  // Kod tahmin etmeye çalışanları durdur: saatte en fazla 10 hatalı deneme
  if (await sinirAsildi(env, "katil:" + ben.id, 10, 3600000, false) || await sinirAsildi(env, "katil-ip:" + ip, 20, 3600000, false)) {
    return hata("Çok fazla hatalı kod denendi. Bir saat sonra tekrar dene.", 429);
  }
  const d = await env.DB.prepare("SELECT * FROM davetler WHERE kod = ?").bind(kod).first();
  if (!d || d.bitis < Date.now()) {
    await hataliDeneme(env, "katil:" + ben.id, "katil-ip:" + ip);
    return hata("Bu kod geçersiz ya da süresi dolmuş", 404);
  }
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
    "SELECT u.id, u.ad, u.durum, u.durum_zamani, u.durum_konum, u.tam, p.olusma FROM baglar p JOIN kullanicilar u ON u.id = p.b WHERE p.a = ? ORDER BY p.olusma"
  ).bind(ben.id).all();
  const sonuc = [];
  const alti = Date.now() - 6 * 60 * 60 * 1000;
  for (const k of liste.results || []) {
    const [benden, ondan] = await env.DB.batch([
      env.DB.prepare("SELECT id, zaman, cevap, cevap_zamani, konum FROM sorular WHERE kimden = ? AND kime = ? ORDER BY zaman DESC LIMIT 1").bind(ben.id, k.id),
      env.DB.prepare("SELECT id, zaman FROM sorular WHERE kimden = ? AND kime = ? AND cevap IS NULL AND zaman > ? ORDER BY zaman DESC LIMIT 1").bind(k.id, ben.id, alti),
    ]);
    const son = (benden.results && benden.results[0]) || null;
    if (son) {
      try { son.konum = son.konum ? JSON.parse(son.konum) : null; } catch (e) { son.konum = null; }
    }
    sonuc.push({
      id: k.id,
      ad: k.ad,
      tam: !!k.tam,
      sonSoru: son,
      bekleyenSoru: (ondan.results && ondan.results[0]) || null,
      sonDurum: k.durum ? { cevap: k.durum, zaman: k.durum_zamani, konum: konumOku(k.durum_konum) } : null,
    });
  }
  const hs = await env.DB.prepare("SELECT COUNT(*) AS n FROM hediyeler WHERE veren = ? AND IFNULL(iptal,0) = 0").bind(ben.id).first();
  return json({ ben: { id: ben.id, ad: ben.ad, tam: !!ben.tam, hediyeSayisi: hs ? hs.n : 0 }, kisiler: sonuc, simdi: Date.now(), soruArasi: SORU_ARASI_MS });
}

/**
 * Son 24 saatin bildirim geçmişi: sorduğun/sorulan sorular, cevaplar, yakınlarının "herkese" durumları, yeni eşleşmeler.
 * tip: sordun | sordu | cevapladi | cevapladin | durum | durumun | eklendi
 */
async function gecmis(env, ben) {
  const sinir = Date.now() - GECMIS_MS;
  const [bendenS, banaS, durumS, bagS] = await env.DB.batch([
    env.DB.prepare("SELECT s.id, s.kime AS kim, u.ad, s.zaman, s.cevap, s.cevap_zamani, s.konum FROM sorular s LEFT JOIN kullanicilar u ON u.id = s.kime WHERE s.kimden = ? AND (s.zaman > ? OR s.cevap_zamani > ?)").bind(ben.id, sinir, sinir),
    env.DB.prepare("SELECT s.id, s.kimden AS kim, u.ad, s.zaman, s.cevap, s.cevap_zamani FROM sorular s LEFT JOIN kullanicilar u ON u.id = s.kimden WHERE s.kime = ? AND (s.zaman > ? OR s.cevap_zamani > ?)").bind(ben.id, sinir, sinir),
    env.DB.prepare("SELECT d.kimden AS kim, u.ad, d.durum, d.zaman, d.konum FROM durumlar d LEFT JOIN kullanicilar u ON u.id = d.kimden WHERE d.zaman > ? AND (d.kimden = ? OR d.kimden IN (SELECT b FROM baglar WHERE a = ?))").bind(sinir, ben.id, ben.id),
    env.DB.prepare("SELECT p.b AS kim, u.ad, p.olusma AS zaman FROM baglar p JOIN kullanicilar u ON u.id = p.b WHERE p.a = ? AND p.olusma > ?").bind(ben.id, sinir),
  ]);
  const l = [];
  const ad = (x) => x.ad || "";
  for (const x of bendenS.results || []) {
    if (x.zaman > sinir) l.push({ tip: "sordun", kim: x.kim, ad: ad(x), zaman: x.zaman });
    if (x.cevap && x.cevap_zamani > sinir) l.push({ tip: "cevapladi", kim: x.kim, ad: ad(x), zaman: x.cevap_zamani, cevap: x.cevap, konum: konumOku(x.konum) });
  }
  for (const x of banaS.results || []) {
    if (x.zaman > sinir) l.push({ tip: "sordu", kim: x.kim, ad: ad(x), zaman: x.zaman });
    if (x.cevap && x.cevap_zamani > sinir) l.push({ tip: "cevapladin", kim: x.kim, ad: ad(x), zaman: x.cevap_zamani, cevap: x.cevap });
  }
  for (const x of durumS.results || []) {
    const benim = x.kim === ben.id;
    l.push({ tip: benim ? "durumun" : "durum", kim: x.kim, ad: ad(x), zaman: x.zaman, cevap: x.durum, konum: benim ? null : konumOku(x.konum) });
  }
  for (const x of bagS.results || []) l.push({ tip: "eklendi", kim: x.kim, ad: ad(x), zaman: x.zaman });
  l.sort((a, b) => b.zaman - a.zaman);
  return json({ olaylar: l.slice(0, 300), simdi: Date.now() });
}

const TAM_GEREKLI = (neden) => hata(neden, 402, { tamGerekli: true });

async function sor(env, ben, g) {
  if (!ben.tam) return TAM_GEREKLI("“İyi mi?” diye sormak için İyiyim Tam gerekli");
  const kime = String(g.kime || "");
  if (!(await bagliMi(env, ben.id, kime))) return hata("Bu kişi listende yok", 404);
  const son = await env.DB.prepare("SELECT zaman FROM sorular WHERE kimden = ? AND kime = ? ORDER BY zaman DESC LIMIT 1")
    .bind(ben.id, kime).first();
  const simdi = Date.now();
  if (SORU_ARASI_MS > 0 && son && simdi - son.zaman < SORU_ARASI_MS) {
    return hata("Aynı kişiye 30 dakikada bir sorabilirsin", 429, { kalan: SORU_ARASI_MS - (simdi - son.zaman) });
  }
  // Rahatsız etmeyi önle: aynı kişiye saatte en fazla 12 soru
  if (await sinirAsildi(env, "sor:" + ben.id + ":" + kime, 12, 3600000, true)) {
    return hata("Bu kişiye çok sık sordun. Biraz bekle ya da onu ara.", 429);
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
  // Konum yalnızca "Yardım lazım" ile ve kullanıcının telefonu verdiyse gelir
  const konum = c === "yardim" ? konumTemizle(g.konum, simdi) : null;
  await env.DB.prepare("UPDATE sorular SET cevap = ?, cevap_zamani = ?, konum = ? WHERE id = ?")
    .bind(c, simdi, konum ? JSON.stringify(konum) : null, s.id).run();
  const soran = await env.DB.prepare("SELECT id, ad, token FROM kullanicilar WHERE id = ?").bind(s.kimden).first();
  const veri = { tip: "cevap", soruId: s.id, kimden: ben.id, ad: ben.ad, cevap: c };
  if (konum) Object.assign(veri, { lat: konum.lat, lng: konum.lng, hassas: konum.hassas == null ? "" : konum.hassas });
  const ulasti = await bildirimGonder(env, soran, veri, 86400);
  return json({ tamam: true, ulasti });
}

async function herkese(env, ctx, ben, g) {
  const c = String(g.cevap || "iyi");
  if (!CEVAPLAR.includes(c)) return hata("Geçersiz durum");
  // Yardım isteği herkese ücretsiz; günlük "İyiyim" bildirimi İyiyim Tam ister
  if (c !== "yardim" && !ben.tam) return TAM_GEREKLI("Herkese “İyiyim” demek için İyiyim Tam gerekli");
  const simdi = Date.now();
  // Yardım isteği acil durumdur: hiçbir zaman bekletilmez
  if (c !== "yardim" && ben.durum !== "yardim" && ben.durum_zamani && simdi - ben.durum_zamani < HERKESE_ARASI_MS) {
    return hata("Herkese 10 dakikada bir bildirebilirsin", 429, { kalan: HERKESE_ARASI_MS - (simdi - ben.durum_zamani) });
  }
  // Kötüye kullanım sınırı (gerçek bir acil durumda asla dolmaz): saatte 30 yardım isteği
  if (c === "yardim" && await sinirAsildi(env, "yardim:" + ben.id, 30, 3600000, true)) {
    return hata("Çok fazla yardım isteği gönderildi. Acil durumdaysan 112'yi ara.", 429);
  }
  const alti = simdi - 6 * 60 * 60 * 1000;
  const konum = c === "yardim" ? konumTemizle(g.konum, simdi) : null;
  // Konum alınamadıysa son bilinen yardım konumunu koru
  const konumMetni = konum ? JSON.stringify(konum) : (c === "yardim" ? ben.durum_konum || null : null);
  await env.DB.batch([
    env.DB.prepare("UPDATE kullanicilar SET durum = ?, durum_zamani = ?, durum_konum = ? WHERE id = ?").bind(c, simdi, konumMetni, ben.id),
    env.DB.prepare("INSERT INTO durumlar (kimden, durum, zaman, konum) VALUES (?, ?, ?, ?)").bind(ben.id, c, simdi, konum ? JSON.stringify(konum) : null),
    // Bana sorulmuş ve henüz cevaplamadığım sorular da bu durumla cevaplanmış sayılır
    env.DB.prepare("UPDATE sorular SET cevap = ?, cevap_zamani = ?, konum = ? WHERE kime = ? AND cevap IS NULL AND zaman > ?").bind(c, simdi, konumMetni, ben.id, alti),
  ]);
  const liste = await env.DB.prepare(
    "SELECT u.id, u.ad, u.token FROM baglar p JOIN kullanicilar u ON u.id = p.b WHERE p.a = ?"
  ).bind(ben.id).all();
  const kisiler = liste.results || [];
  const sonuclar = await Promise.all(kisiler.map((k) =>
    bildirimGonder(env, k, Object.assign(
      { tip: "durum", kimden: ben.id, ad: ben.ad, cevap: c, zaman: String(simdi) },
      konum ? { lat: konum.lat, lng: konum.lng, hassas: konum.hassas == null ? "" : konum.hassas, konumYeni: "1" } : {}
    ), 86400)
  ));
  return json({ tamam: true, kisi: kisiler.length, ulasan: sonuclar.filter(Boolean).length });
}

// ---------------- İyiyim Tam ve hediye ----------------
function temizToken(t) {
  const x = String(t || "").trim();
  return x.length >= 10 && x.length <= 4096 ? x : "";
}

/**
 * Satın alma jetonunu Google Play'e sorar. Google "ödendi" demeden hiçbir şey açılmaz.
 * Dönüş: { ok, satin } ya da { ok:false, durum, mesaj, tekrar } (tekrar=true: geçici sorun, sonra yeniden denenebilir)
 */
async function playDogrula(env, urun, token) {
  const { hesap, hata: h } = hesapOku(env);
  if (h) return { ok: false, durum: 503, tekrar: true, mesaj: "Ödeme şu an doğrulanamadı. Birazdan kendiliğinden tekrar denenecek." };
  let r;
  try {
    const jeton = await googleJetonu(hesap, "https://www.googleapis.com/auth/androidpublisher");
    r = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PAKET}/purchases/products/${urun}/tokens/${encodeURIComponent(token)}`, {
      headers: { Authorization: "Bearer " + jeton },
    });
  } catch (e) {
    console.error("Play doğrulama bağlantısı", e && e.message);
    return { ok: false, durum: 503, tekrar: true, mesaj: "Google Play'e ulaşılamadı. Birazdan kendiliğinden tekrar denenecek." };
  }
  if (r.status === 400 || r.status === 404 || r.status === 410) {
    return { ok: false, durum: 402, tekrar: false, mesaj: "Bu satın alma Google Play'de bulunamadı." };
  }
  if (!r.ok) {
    // 401/403: hizmet hesabı Play Console'a henüz davet edilmemiş; 5xx: Google tarafı
    console.error("Play doğrulama", r.status, (await r.text()).slice(0, 300));
    return { ok: false, durum: 503, tekrar: true, mesaj: "Ödeme şu an doğrulanamadı. Birazdan kendiliğinden tekrar denenecek." };
  }
  const v = await r.json();
  // purchaseState: 0 ödendi, 1 iptal, 2 bekliyor
  if (v.purchaseState === 2) return { ok: false, durum: 402, tekrar: true, mesaj: "Ödemen onay bekliyor. Onaylanınca kendiliğinden açılacak." };
  if (v.purchaseState !== 0) return { ok: false, durum: 402, tekrar: false, mesaj: "Bu satın alma iptal edilmiş ya da iade edilmiş." };
  return { ok: true, satin: v };
}

const dogrulamaHatasi = (d) => hata(d.mesaj, d.durum, { tekrar: !!d.tekrar });

/** Kullanıcının Tam hakkını geçerli kaynaklardan yeniden hesaplar (iade/taşıma sonrası). */
async function tamHesapla(env, kullanici) {
  if (!kullanici) return;
  await env.DB.prepare(
    `UPDATE kullanicilar SET tam = CASE WHEN eski = 1
       OR EXISTS (SELECT 1 FROM satinalmalar WHERE kullanici = ?1 AND urun = '${URUN_TAM}' AND IFNULL(iptal,0) = 0)
       OR EXISTS (SELECT 1 FROM hediyeler WHERE kullanan = ?1 AND IFNULL(iptal,0) = 0)
     THEN 1 ELSE 0 END WHERE id = ?1`
  ).bind(kullanici).run();
}

/** Satın alınan (ya da geri yüklenen) İyiyim Tam'ı bu hesaba bağlar. */
async function tamKaydet(env, ben, g) {
  const token = temizToken(g.token);
  if (!token) return hata("Satın alma bilgisi eksik");
  const simdi = Date.now();
  const var_ = await env.DB.prepare("SELECT * FROM satinalmalar WHERE token = ?").bind(token).first();
  if (var_ && var_.urun !== URUN_TAM) return hata("Bu satın alma İyiyim Tam değil");
  if (var_ && var_.iptal) return hata("Bu satın alma iade edilmiş ya da iptal olmuş", 402);
  if (var_ && var_.kullanici === ben.id) {
    await tamHesapla(env, ben.id);
    return json({ tamam: true, tam: true });
  }
  const d = await playDogrula(env, URUN_TAM, token);
  if (!d.ok) return dogrulamaHatasi(d);
  if (var_ && var_.kullanici) {
    // Aynı Google hesabıyla yeniden kurulum: Tam yeni hesaba taşınır (paylaşılmasın diye 3 günde bir)
    const son = var_.tasima || 0; // ilk taşıma serbest (yeniden kurulum), sonrakiler 3 günde bir
    const eskiVar = await env.DB.prepare("SELECT 1 FROM kullanicilar WHERE id = ?").bind(var_.kullanici).first();
    if (eskiVar && simdi - son < TASIMA_ARASI_MS) {
      return hata("Bu satın alma başka bir hesapta kullanılıyor. Kısa süre önce taşındığı için 3 gün sonra tekrar dene ya da bize yaz.", 409);
    }
  } else {
    // İlk kez kaydediliyorsa, satın almayı bu hesabın başlatmış olması gerekir
    const sahip = d.satin.obfuscatedExternalAccountId;
    if (sahip && sahip !== ben.id) return hata("Bu satın alma başka bir hesaba ait", 409);
  }
  await env.DB.prepare(
    `INSERT INTO satinalmalar (token, urun, kullanici, olusma, siparis, tasima) VALUES (?, '${URUN_TAM}', ?, ?, ?, NULL)
     ON CONFLICT(token) DO UPDATE SET kullanici = excluded.kullanici, tasima = ?`
  ).bind(token, ben.id, simdi, d.satin.orderId || null, simdi).run();
  if (var_ && var_.kullanici && var_.kullanici !== ben.id) await tamHesapla(env, var_.kullanici);
  await tamHesapla(env, ben.id);
  return json({ tamam: true, tam: true });
}

/** Hediye: kime verilirse o kişiye anında Tam; verilmezse paylaşılacak bir kod üretilir. */
async function hediyeVer(env, ctx, ben, g) {
  const token = temizToken(g.token);
  if (!token) return hata("Satın alma bilgisi eksik");
  const simdi = Date.now();
  const once = await env.DB.prepare("SELECT * FROM hediyeler WHERE token = ?").bind(token).first();
  if (once) {
    if (once.veren !== ben.id) return hata("Bu satın alma başka bir hesaba ait", 409);
    const kimeAd = once.kullanan ? await env.DB.prepare("SELECT ad FROM kullanicilar WHERE id = ?").bind(once.kullanan).first() : null;
    return json({ tamam: true, kod: once.kod, kullanildi: !!once.kullanan, kime: kimeAd ? kimeAd.ad : "", tekrar: true }); // tekrar gönderim: aynı sonuç
  }

  const kime = String(g.kime || "");
  let o = null;
  if (kime) {
    if (!(await bagliMi(env, ben.id, kime))) return hata("Bu kişi listende yok", 404);
    o = await env.DB.prepare("SELECT id, ad, token, tam FROM kullanicilar WHERE id = ?").bind(kime).first();
    if (!o) return hata("Kişi bulunamadı", 404);
  }
  // Kademeli fiyat: ilk hediye 79,99; daha önce (iade edilmemiş) hediye verdiyse 49,99
  const urun = g.urun === URUN_HEDIYE_IND ? URUN_HEDIYE_IND : URUN_HEDIYE;
  if (urun === URUN_HEDIYE_IND) {
    const hs = await env.DB.prepare("SELECT COUNT(*) AS n FROM hediyeler WHERE veren = ? AND IFNULL(iptal,0) = 0").bind(ben.id).first();
    if (!hs || hs.n < 1) return hata("İndirimli hediye için önce bir hediye vermiş olmalısın", 402);
  }
  const d = await playDogrula(env, urun, token);
  if (!d.ok) return dogrulamaHatasi(d);
  const sahip = d.satin.obfuscatedExternalAccountId;
  if (sahip && sahip !== ben.id) return hata("Bu satın alma başka bir hesaba ait", 409);

  // Kişi bu arada Tam olduysa hediye boşa gitmesin: kod olarak verilir, başkasına iletilebilir
  const kisiye = o && !o.tam;
  const kod = await yeniKod(env);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO hediyeler (kod, veren, token, kullanan, olusma) VALUES (?, ?, ?, ?, ?)").bind(kod, ben.id, token, kisiye ? o.id : null, simdi),
    env.DB.prepare(`INSERT OR IGNORE INTO satinalmalar (token, urun, kullanici, olusma, siparis) VALUES (?, ?, ?, ?, ?)`).bind(token, urun, ben.id, simdi, d.satin.orderId || null),
  ]);
  if (kisiye) {
    await tamHesapla(env, o.id);
    ctx.waitUntil(bildirimGonder(env, o, { tip: "hediye", kimden: ben.id, ad: ben.ad }, 86400));
    return json({ tamam: true, kime: o.ad });
  }
  return json({ tamam: true, kod, zatenTam: o ? o.ad : "" });
}

/** Verdiğim hediyeler: kod, kime ulaştığı, iade durumu */
async function hediyelerim(env, ben) {
  const l = await env.DB.prepare(
    "SELECT h.kod, h.olusma, IFNULL(h.iptal,0) AS iptal, u.ad AS kullanan FROM hediyeler h LEFT JOIN kullanicilar u ON u.id = h.kullanan WHERE h.veren = ? ORDER BY h.olusma DESC LIMIT 50"
  ).bind(ben.id).all();
  return json({ hediyeler: (l.results || []).map((x) => ({ kod: x.kod, zaman: x.olusma, kullanan: x.kullanan || "", iptal: !!x.iptal })) });
}

async function yeniKod(env) {
  for (let i = 0; i < 8; i++) {
    const a = new Uint8Array(8);
    crypto.getRandomValues(a);
    const kod = "H" + [...a].map((x) => KOD_HARFLERI[x % KOD_HARFLERI.length]).join("").slice(0, 7);
    const v = await env.DB.prepare("SELECT 1 FROM hediyeler WHERE kod = ?").bind(kod).first();
    if (!v) return kod;
  }
  throw new Error("Hediye kodu üretilemedi");
}

async function hediyeKullan(env, ctx, ben, g, ip) {
  const kod = String(g.kod || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (kod.length !== 8) return hata("Hediye kodu 8 karakter olmalı (H ile başlar)");
  if (await sinirAsildi(env, "hediye:" + ben.id, 5, 3600000, false) || await sinirAsildi(env, "hediye-ip:" + ip, 10, 3600000, false)) {
    return hata("Çok fazla hatalı kod denendi. Bir saat sonra tekrar dene.", 429);
  }
  const h = await env.DB.prepare("SELECT * FROM hediyeler WHERE kod = ?").bind(kod).first();
  if (!h) {
    await hataliDeneme(env, "hediye:" + ben.id, "hediye-ip:" + ip);
    return hata("Bu hediye kodu bulunamadı", 404);
  }
  if (h.iptal) return hata("Bu hediye iade edildiği için geçersiz", 410);
  if (h.kullanan && h.kullanan !== ben.id) return hata("Bu hediye kodu daha önce kullanılmış", 409);
  if (ben.tam && !h.kullanan) return hata("Sen zaten İyiyim Tam kullanıyorsun. Bu kodu Tam'ı olmayan bir yakınına ver.", 409);
  await env.DB.prepare("UPDATE hediyeler SET kullanan = ? WHERE kod = ? AND kullanan IS NULL").bind(ben.id, kod).run();
  await tamHesapla(env, ben.id);
  const veren = await env.DB.prepare("SELECT id, ad, token FROM kullanicilar WHERE id = ?").bind(h.veren).first();
  if (veren && !h.kullanan) ctx.waitUntil(bildirimGonder(env, veren, { tip: "hediyeKullanildi", kimden: ben.id, ad: ben.ad }, 86400));
  return json({ tamam: true, veren: veren ? veren.ad : "" });
}

/** Google Play'in iade/iptal listesini okuyup ilgili Tam haklarını kapatır. */
async function iadeleriIsle(env) {
  const { hesap, hata: h } = hesapOku(env);
  if (h) return;
  const simdi = Date.now();
  const kayit = await env.DB.prepare("SELECT deger FROM ayarlar WHERE ad = 'iade_son'").first();
  // Google son 30 günü verir; bir gün örtüşmeyle en son baktığımız yerden başla
  const baslangic = Math.max(simdi - 29 * 86400000, (kayit ? Number(kayit.deger) : 0) - 86400000);
  let sayfa = "";
  let islenen = 0;
  try {
    const jeton = await googleJetonu(hesap, "https://www.googleapis.com/auth/androidpublisher");
    for (let i = 0; i < 20; i++) {
      const u = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PAKET}/purchases/voidedpurchases?startTime=${baslangic}&maxResults=1000` + (sayfa ? "&token=" + encodeURIComponent(sayfa) : "");
      const r = await fetch(u, { headers: { Authorization: "Bearer " + jeton } });
      if (!r.ok) {
        console.error("İade listesi alınamadı", r.status, (await r.text()).slice(0, 300));
        return;
      }
      const v = await r.json();
      for (const x of v.voidedPurchases || []) {
        await satinAlmaIptal(env, x.purchaseToken);
        islenen++;
      }
      sayfa = v.tokenPagination && v.tokenPagination.nextPageToken;
      if (!sayfa) break;
    }
    await env.DB.prepare("INSERT INTO ayarlar (ad, deger) VALUES ('iade_son', ?) ON CONFLICT(ad) DO UPDATE SET deger = excluded.deger").bind(String(simdi)).run();
    console.log("İade kontrolü tamam:", islenen);
  } catch (e) {
    console.error("İade kontrolü", e && e.message);
  }
}

async function satinAlmaIptal(env, token) {
  if (!token) return;
  const s = await env.DB.prepare("SELECT * FROM satinalmalar WHERE token = ?").bind(token).first();
  const h = await env.DB.prepare("SELECT * FROM hediyeler WHERE token = ?").bind(token).first();
  if (s) await env.DB.prepare("UPDATE satinalmalar SET iptal = 1 WHERE token = ?").bind(token).run();
  if (h) await env.DB.prepare("UPDATE hediyeler SET iptal = 1 WHERE token = ?").bind(token).run();
  if (s && s.urun === URUN_TAM) await tamHesapla(env, s.kullanici);
  if (h && h.kullanan) await tamHesapla(env, h.kullanan);
}

function konumTemizle(k, simdi) {
  if (!k || !isFinite(k.lat) || !isFinite(k.lng)) return null;
  return {
    lat: Math.round(Number(k.lat) * 1e6) / 1e6,
    lng: Math.round(Number(k.lng) * 1e6) / 1e6,
    hassas: isFinite(k.hassas) && k.hassas !== null ? Math.round(Number(k.hassas)) : null,
    zaman: isFinite(k.zaman) ? Number(k.zaman) : simdi,
  };
}
function konumOku(metin) {
  try { return metin ? JSON.parse(metin) : null; } catch (e) { return null; }
}

async function temizlik(env) {
  const simdi = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sorular WHERE zaman < ?").bind(simdi - SAKLAMA_MS),
    env.DB.prepare("DELETE FROM davetler WHERE bitis < ?").bind(simdi),
    env.DB.prepare("DELETE FROM sinirlar WHERE zaman < ?").bind(simdi - 86400000),
    env.DB.prepare("DELETE FROM durumlar WHERE zaman < ?").bind(simdi - 2 * GECMIS_MS),
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
    env.DB.prepare("DELETE FROM durumlar WHERE kimden = ?").bind(ben.id),
    env.DB.prepare("DELETE FROM kullanicilar WHERE id = ?").bind(ben.id),
  ]);
  return json({ tamam: true });
}

// ---------- Firebase Cloud Messaging ----------
const googleErisim = {}; // kapsam -> { jeton, bitis }

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

async function googleJetonu(hesap, kapsam = "https://www.googleapis.com/auth/firebase.messaging") {
  const k = googleErisim[kapsam];
  if (k && Date.now() < k.bitis - 60000) return k.jeton;
  const simdi = Math.floor(Date.now() / 1000);
  const kodla = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const imzasiz = kodla({ alg: "RS256", typ: "JWT" }) + "." + kodla({
    iss: hesap.client_email,
    scope: kapsam,
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
  googleErisim[kapsam] = { jeton: v.access_token, bitis: Date.now() + (v.expires_in || 3600) * 1000 };
  return v.access_token;
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
