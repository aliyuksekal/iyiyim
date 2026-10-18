/* İyiyim — arayüz mantığı */
(function () {
  "use strict";

  // ---------- Capacitor köprüsü (tarayıcıda deneme için sahte sürüm) ----------
  const Cap = window.Capacitor;
  const yerel = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const P = (Cap && Cap.Plugins) || {};
  const Iyiyim = yerel && P.Iyiyim ? P.Iyiyim : sahteEklenti();
  const UygulamaP = P.App || null;
  const PaylasP = P.Share || null;
  const DurumCubugu = P.StatusBar || null;

  function sahteEklenti() {
    const dinleyiciler = [];
    return {
      ayarla: async () => ({}),
      jetonAl: async () => ({ token: "" }),
      bildirimIzni: async () => ({ durum: "granted" }),
      izinDurumu: async () => ({ bildirim: true, tamAlarm: true, pilMuaf: false, ustte: false, tamEkran: false, konum: true, ton: "zil", sdk: 34 }),
      pilAyari: async () => ({}),
      alarmAyari: async () => ({}),
      usteAyari: async () => ({}),
      bildirimAyari: async () => ({}),
      uygulamaAyarlariAc: async () => ({}),
      cevapSirala: async () => ({}),
      cihaz: async () => ({ marka: "Xiaomi", model: "Redmi Note 12", sdk: 34, surum: "14" }),
      tamEkranAyari: async () => ({}),
      widgetEkle: async () => ({ destek: false }),
      widgetOlaylari: async () => ({}),
      konumIzni: async () => ({ durum: "granted" }),
      konumAl: async () => ({ lat: 41.0082, lng: 28.9784, hassas: 15, zaman: Date.now() }),
      tonSec: async (o) => ({ ton: o.ton }),
      tonDinle: async () => ({}),
      tonDurdur: async () => ({}),
      destekFiyati: async () => ({ durum: "hata", fiyat: "", mesaj: "" }),
      urunFiyatlari: async () => ({ fiyatlar: {}, mesaj: "" }),
      satinAl: async () => ({ durum: "hata", token: "", mesaj: "Satın alma Play Store sürümünde etkin olacak." }),
      sahipOlunanlar: async () => ({}),
      tuket: async () => ({}),
      tamIstegi: async () => ({ goster: false }),
      dilAyarla: async (o) => ({ dil: o.dil }),
      telefonDili: async () => ({ dil: (navigator.language || "en").slice(0, 2) }),
      destekOl: async () => ({ durum: "hata", mesaj: "Destek seçeneği Play Store sürümünde etkin olacak." }),
      otomatikBaslatma: async () => ({ ozel: true }),
      alarmKur: async (o) => { console.log("alarmKur", o); return {}; },
      alarmIptal: async () => ({}),
      telefonlar: async () => ({}),
      soruBildirimiKapat: async () => ({}),
      olaylariAl: async () => ({ olaylar: [] }),
      addListener: async (ad, fn) => { dinleyiciler.push(fn); return { remove() {} }; },
    };
  }

  // ---------- kalıcı veriler ----------
  const oku = (k, v) => { try { const x = localStorage.getItem("iyiyim." + k); return x ? JSON.parse(x) : v; } catch (e) { return v; } };
  const yaz = (k, v) => { try { localStorage.setItem("iyiyim." + k, JSON.stringify(v)); } catch (e) {} };

  let kimlik = oku("kimlik", null);                   // {id, sifre, ad}
  let ayar = Object.assign({ sureDk: 15, tema: "sistem", ton: "zil" }, oku("ayar", {}));
  if (![15, 30, 60, 120, 240].includes(+ayar.sureDk)) ayar.sureDk = +ayar.sureDk > 120 ? 240 : 15;
  delete ayar.sunucu; // sunucu adresi yalnızca uygulamanın içinden gelir, kullanıcı değiştiremez
  let telefonlar = oku("telefonlar", {});            // {kisiId: "05..."}
  let veri = oku("onbellek", null);                   // son /kisiler cevabı
  let saatFarki = 0;                                  // sunucu - yerel
  let kurulanAlarmlar = oku("alarmlar", {});          // {soruId: true}

  // ---------- dil ----------
  const DILLER = ["tr", "en", "ru", "uz", "zh", "ko", "hi"];
  const DIL = window.IYIYIM_DIL || {};
  function varsayilanDil() {
    const l = (navigator.languages || [navigator.language || "en"]).map((x) => String(x).toLowerCase().slice(0, 2));
    return l.find((x) => DILLER.includes(x)) || "en";
  }
  let aktifDil = DILLER.includes(ayar.dil) ? ayar.dil : varsayilanDil();
  /** Çeviri: anahtar Türkçe metnin kendisidir; {0}, {1} yer tutucuları sırayla doldurulur. */
  function t(k, ...a) {
    const d = DIL[aktifDil];
    const m = (d && d[k]) || k;
    return a.length ? m.replace(/\{(\d)\}/g, (x, i) => (a[i] !== undefined && a[i] !== null ? a[i] : x)) : m;
  }
  const dilEtiketi = () => ({ tr: "tr-TR", en: "en-US", ru: "ru-RU", uz: "uz-Latn-UZ", zh: "zh-CN", ko: "ko-KR", hi: "hi-IN" }[aktifDil] || "en-US");
  const norm = (h) => h.replace(/\s+/g, " ").trim();
  /** HTML'deki data-t öğelerini seçili dile çevirir; özgün Türkçe metin anahtar olarak saklanır. */
  function sayfayiCevir() {
    document.documentElement.lang = aktifDil;
    document.querySelectorAll("[data-t]").forEach((e) => {
      if (e.dataset.tk === undefined) e.dataset.tk = norm(e.innerHTML);
      e.innerHTML = t(e.dataset.tk);
    });
    document.querySelectorAll("[data-t-ph]").forEach((e) => {
      if (e.dataset.tkp === undefined) e.dataset.tkp = e.getAttribute("placeholder");
      e.setAttribute("placeholder", t(e.dataset.tkp));
    });
    document.querySelectorAll("[data-t-aria]").forEach((e) => {
      if (e.dataset.tka === undefined) e.dataset.tka = e.getAttribute("aria-label");
      e.setAttribute("aria-label", t(e.dataset.tka));
    });
    ["#dil-karsilama", "#ayar-dil"].forEach((x) => { const el = document.querySelector(x); if (el) el.value = aktifDil; });
  }

  const sunucu = () => (window.IYIYIM_SUNUCU || "").replace(/\/+$/, "");
  const simdi = () => Date.now() + saatFarki;

  // ---------- kısayollar ----------
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const kacis = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let tostZaman;
  function tost(metin, sure = 2600) {
    const t = $("#tost");
    t.textContent = metin;
    t.hidden = false;
    clearTimeout(tostZaman);
    tostZaman = setTimeout(() => (t.hidden = true), sure);
  }

  // ---------- sunucu ----------
  async function istek(yol, govde, yontem) {
    if (!sunucu() || sunucu().includes("KULLANICI")) throw new Error(t("Sunucu adresi ayarlanmamış"));
    const basliklar = { "Content-Type": "application/json" };
    if (kimlik) { basliklar["X-Id"] = kimlik.id; basliklar["X-Sifre"] = kimlik.sifre; }
    let r;
    try {
      r = await fetch(sunucu() + yol, {
        method: yontem || (govde === undefined ? "GET" : "POST"),
        headers: basliklar,
        body: govde === undefined ? undefined : JSON.stringify(govde || {}),
      });
    } catch (e) {
      const h = new Error(t("İnternete bağlanılamadı"));
      h.ag = true;
      throw h;
    }
    const v = await r.json().catch(() => ({}));
    if (!r.ok) {
      const h = new Error(t(v.hata || t("Bir şeyler ters gitti")));
      h.durum = r.status;
      h.veri = v;
      throw h;
    }
    return v;
  }

  // ---------- tema ----------
  function temaUygula() {
    document.documentElement.dataset.tema = ayar.tema;
    const koyu = ayar.tema === "koyu" || (ayar.tema === "sistem" && !matchMedia("(prefers-color-scheme: light)").matches);
    if (DurumCubugu) {
      DurumCubugu.setStyle({ style: koyu ? "DARK" : "LIGHT" }).catch(() => {});
      DurumCubugu.setBackgroundColor({ color: koyu ? "#0E1726" : "#F3F5F9" }).catch(() => {});
    }
  }
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", temaUygula);

  // ---------- zaman metinleri ----------
  function once(ms) {
    const dk = Math.floor(ms / 60000);
    if (dk < 1) return t("az önce");
    if (dk < 60) return t("{0} dk önce", dk);
    const sa = Math.floor(dk / 60);
    if (sa < 24) return t("{0} sa önce", sa);
    const gun = Math.floor(sa / 24);
    return gun === 1 ? t("dün") : t("{0} gün önce", gun);
  }
  function kalanMetin(ms) {
    const dk = Math.ceil(ms / 60000);
    if (dk < 60) return t("{0} dk", dk);
    const sa = Math.floor(dk / 60), d = dk % 60;
    return d ? t("{0} sa {1} dk", sa, d) : t("{0} sa", sa);
  }
  function saatMetni(z) {
    try { return new Date(z).toLocaleTimeString(dilEtiketi(), { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; }
  }

  // ---------- kişi durumu ----------
  function durumHesapla(k) {
    const s = k.sonSoru;
    const d = k.sonDurum;
    // Kişi kimse sormadan herkese durum bildirdiyse ve bu, son cevaptan yeniyse onu göster
    if (d && (!s || (s.cevap && d.zaman > (s.cevap_zamani || 0)) || (!s.cevap && d.zaman > s.zaman))) {
      const t0 = simdi();
      const soruArasi0 = 0 /* bekleme süresi yok */;
      const kilit0 = s ? Math.max(0, soruArasi0 - (t0 - s.zaman)) : 0;
      if (d.cevap === "yardim") return { sinif: "durum-yardim", metin: t("Yardım istedi · {0}", once(t0 - d.zaman)), kilit: kilit0, olay: "d" + d.zaman, zaman: d.zaman };
      if (d.cevap === "sonra") return { sinif: "durum-sonra", metin: t("Müsait değil · {0}", once(t0 - d.zaman)), kilit: kilit0 };
      return { sinif: "durum-iyi", metin: t("Kendisi bildirdi: İyi · {0}", once(t0 - d.zaman)), kilit: kilit0 };
    }
    const an = simdi();
    const soruArasi = 0 /* bekleme süresi yok */;
    const kilit = s ? Math.max(0, soruArasi - (an - s.zaman)) : 0;
    if (!s) return { sinif: "", metin: t("Henüz sormadın"), kilit };
    if (s.cevap === "yardim") return { sinif: "durum-yardim", metin: t("Yardım istedi · {0}", once(an - s.cevap_zamani)), kilit, olay: "s" + s.id, zaman: s.cevap_zamani };
    if (s.cevap === "iyi") return { sinif: "durum-iyi", metin: t("İyi · {0}", once(an - s.cevap_zamani)), kilit };
    if (s.cevap === "sonra") return { sinif: "durum-sonra", metin: t("Sonra arayacak · {0}", once(an - s.cevap_zamani)), kilit };
    const sureMs = ayar.sureDk * 60000;
    const gecen = an - s.zaman;
    if (gecen < sureMs) return { sinif: "durum-bekliyor", metin: t("Bekleniyor · alarma {0}", kalanMetin(sureMs - gecen)), kilit };
    return { sinif: "durum-cevapsiz", metin: t("Cevap vermedi · {0} soruldu", once(gecen)), kilit, olay: "s" + s.id, zaman: s.zaman + sureMs };
  }

  // Kırmızı (yardım / cevapsız) kart sürekli kırmızı kalıp kimseyi tedirgin etmesin:
  // kişiyle ilgilenince (aradın, konumuna baktın, kartını açtın) ya da 6 saat geçince sakin renge döner.
  let ilgilenilen = oku("ilgilenilen", {}); // kisiId -> olay anahtarı
  const SAKINLESME_MS = 6 * 60 * 60 * 1000;
  function sakinMi(k, d) {
    if (!d.olay) return false;
    return ilgilenilen[k.id] === d.olay || (d.zaman && simdi() - d.zaman > SAKINLESME_MS);
  }
  function ilgilenildi(kisiId) {
    const k = ((veri && veri.kisiler) || []).find((x) => x.id === kisiId);
    if (!k) return;
    const d = durumHesapla(k);
    if (!d.olay || ilgilenilen[kisiId] === d.olay) return;
    ilgilenilen[kisiId] = d.olay;
    yaz("ilgilenilen", ilgilenilen);
    setTimeout(ciz, 400); // arama/harita açılırken kart yumuşakça sakinleşsin
  }

  const PIN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>';
  const ARA_SVG = '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>';

  function ciz() {
    if (!kimlik) return;
    $("#selam").textContent = t("Merhaba {0}.", kimlik.ad);
    const liste = (veri && veri.kisiler) || [];
    $("#hizli").hidden = liste.length === 0;

    // gelen sorular
    const gelen = liste.filter((k) => k.bekleyenSoru);
    $("#gelen-sorular").innerHTML = gelen.map((k) => `
      <div class="gelen" data-soru="${kacis(k.bekleyenSoru.id)}">
        <p>${kacis(t("{0} soruyor: İyi misin?", k.ad))}<small>${once(simdi() - k.bekleyenSoru.zaman)}</small></p>
        <div class="uclu">
          <button class="dugme cevap-iyi-kucuk" data-cevap="iyi">${t("İyiyim")}</button>
          <button class="dugme dugme-ikincil" data-cevap="sonra">${t("Sonra")}</button>
          <button class="dugme cevap-yardim" data-cevap="yardim">${t("Yardım")}</button>
        </div>
      </div>`).join("");

    $("#bos").hidden = liste.length > 0;
    $("#kisi-liste").innerHTML = liste.map((k) => {
      const d = durumHesapla(k);
      const tel = telefonlar[k.id];
      // "İyi mi?" her zaman var; acil durumda yanında arama düğmesi de çıkar
      let sag = `<button class="sor-dugme${tamYok() ? " kilitli" : ""}" data-sor="${kacis(k.id)}">${t("İyi mi?")}</button>`;
      if ((d.sinif === "durum-yardim" || d.sinif === "durum-cevapsiz") && tel) {
        sag = `<div class="sag-dugmeler"><a class="ara-yuvarlak" aria-label="${kacis(t("{0} kişisini ara", k.ad))}" href="tel:${kacis(tel.replace(/[^0-9+]/g, ""))}">${ARA_SVG}</a>${sag}</div>`;
      }
      return `
        <div class="kisi ${d.sinif}${sakinMi(k, d) ? " sakin" : ""}" data-kart="${kacis(k.id)}">
          <div class="avatar" aria-hidden="true">${kacis(Array.from((k.ad || "?").trim())[0].toLocaleUpperCase(dilEtiketi()))}</div>
          <div class="kisi-orta">
            <button class="kisi-bilgi" data-kisi="${kacis(k.id)}">
              <span class="kisi-ad">${kacis(k.ad)}</span>
              <span class="kisi-durum">${kacis(d.metin)}</span>
            </button>
            ${(() => {
              if (d.sinif !== "durum-yardim") return "";
              const kn = (k.sonDurum && k.sonDurum.cevap === "yardim" && k.sonDurum.konum) || (k.sonSoru && k.sonSoru.konum);
              return kn ? `<a class="konum-link" href="https://www.google.com/maps/search/?api=1&query=${kn.lat},${kn.lng}">${PIN_SVG}${t("Konumu gör")}</a>` : "";
            })()}
          </div>
          ${sag}
        </div>`;
    }).join("");
  }

  // ---------- yenileme ----------
  let yenileniyor = false;
  async function yenile(sessiz = true) {
    if (!kimlik || yenileniyor) return;
    yenileniyor = true;
    try {
      const v = await istek("/kisiler");
      saatFarki = v.simdi - Date.now();
      veri = v;
      yaz("onbellek", v);
      $("#baglanti-uyari").hidden = true;
      alarmlariEsitle();
      ciz();
      tamGoster();
      widgetGuncelle(v);
      // Bildirim kaçmış olsa bile, uygulama açıkken bekleyen soruyu tam ekran göster
      const bekleyen = (v.kisiler || []).filter((k) => k.bekleyenSoru && !gosterilenSorular.has(k.bekleyenSoru.id))
        .sort((p, q) => q.bekleyenSoru.zaman - p.bekleyenSoru.zaman)[0];
      if (bekleyen && document.visibilityState === "visible" && $("#soru-ekran").hidden) {
        soruEkraniGoster(bekleyen.bekleyenSoru.id, bekleyen.ad);
      }
    } catch (e) {
      if (e.durum === 401) { hesabiSifirla(); return; }
      const u = $("#baglanti-uyari");
      u.textContent = e.ag ? t("İnternet yok gibi. Bağlanınca liste güncellenecek.") : e.message;
      u.hidden = false;
      if (!sessiz) tost(e.message);
      ciz();
    } finally {
      yenileniyor = false;
    }
  }

  // Ana ekran widget'ının kayan satırı: her yakının en son haberi
  function widgetGuncelle(v) {
    const liste = [];
    for (const k of v.kisiler || []) {
      const adaylar = [];
      if (k.sonDurum && k.sonDurum.cevap) adaylar.push({ tur: k.sonDurum.cevap, zaman: k.sonDurum.zaman });
      if (k.sonSoru && k.sonSoru.cevap) adaylar.push({ tur: k.sonSoru.cevap, zaman: k.sonSoru.cevap_zamani });
      if (!adaylar.length) continue;
      adaylar.sort((p, q) => q.zaman - p.zaman);
      liste.push({ id: k.id, ad: k.ad, tur: adaylar[0].tur, zaman: adaylar[0].zaman - saatFarki });
    }
    Iyiyim.widgetOlaylari({ liste }).catch(() => {});
  }

  // Cevaplanmış sorulara ait alarmları iptal et (yerel taraf zaten iptal eder, bu ikinci emniyet)
  function alarmlariEsitle() {
    for (const k of (veri && veri.kisiler) || []) {
      const s = k.sonSoru;
      if (s && s.cevap && kurulanAlarmlar[s.id]) {
        Iyiyim.alarmIptal({ soruId: s.id }).catch(() => {});
        delete kurulanAlarmlar[s.id];
      }
    }
    yaz("alarmlar", kurulanAlarmlar);
  }

  // ---------- sorma ----------
  async function sor(kisiId, dugme) {
    const k = ((veri && veri.kisiler) || []).find((x) => x.id === kisiId);
    if (!k) return;
    if (tamYok()) { tamAc(t("“{0} iyi mi?” diye sormak ve cevap gelmezse alarm kurmak İyiyim Tam ile açılır.", k.ad)); return; }
    dugme.disabled = true;
    dugme.textContent = t("…");
    try {
      const v = await istek("/sor", { kime: kisiId });
      const alarmZamani = Date.now() + ayar.sureDk * 60000;
      await Iyiyim.alarmKur({ soruId: v.soruId, kisiId, ad: k.ad, telefon: telefonlar[kisiId] || "", zaman: alarmZamani }).catch(() => {});
      kurulanAlarmlar[v.soruId] = true;
      yaz("alarmlar", kurulanAlarmlar);
      k.sonSoru = { id: v.soruId, zaman: v.zaman, cevap: null, cevap_zamani: null };
      ciz();
      tost(v.ulasti ? t("Soru gönderildi: {0}", k.ad) : t("Soru kaydedildi. {0} uygulamayı açınca görecek.", k.ad), 3200);
      if ("vibrate" in navigator) navigator.vibrate(20);
    } catch (e) {
      if (e.durum === 402 && e.veri && e.veri.tamGerekli) { tamDegisti(false); tamAc(t("“{0} iyi mi?” diye sormak İyiyim Tam ile açılır.", k.ad)); }
      else if (e.durum === 429 && e.veri && e.veri.kalan) tost(`${kalanMetin(e.veri.kalan)} sonra tekrar sorabilirsin`);
      else tost(e.message);
      yenile();
    }
  }

  // ---------- cevaplama ----------
  async function cevapla(soruId, cevap) {
    const gelen = ((veri && veri.kisiler) || []).find((k) => k.bekleyenSoru && k.bekleyenSoru.id === soruId);
    let konum = null;
    if (cevap === "yardim") {
      tost(t("Konumun alınıyor…"), 10000);
      const k = await Iyiyim.konumAl().catch(() => ({}));
      if (k && isFinite(k.lat) && isFinite(k.lng)) konum = k;
    }
    try {
      await istek("/cevap", konum ? { soruId, cevap, konum } : { soruId, cevap });
      Iyiyim.soruBildirimiKapat({ soruId }).catch(() => {});
      tost(cevap === "iyi" ? t("“İyiyim” gönderildi") : cevap === "sonra" ? t("“Sonra ararım” gönderildi") : konum ? t("Yardım isteğin ve konumun gönderildi") : t("Yardım isteğin gönderildi"));
      $("#soru-ekran").hidden = true;
      yenile();
    } catch (e) {
      if (e.ag && yerel) {
        await Iyiyim.cevapSirala({ soruId, cevap, ad: gelen ? gelen.ad : "", konum: konum || undefined }).catch(() => {});
        $("#soru-ekran").hidden = true;
        tost(t("İnternet yok. Cevabın bağlantı gelince otomatik gönderilecek."), 4000);
      } else {
        tost(e.message);
      }
    }
  }

  const gosterilenSorular = new Set();
  function soruEkraniGoster(soruId, ad) {
    gosterilenSorular.add(soruId);
    const e = $("#soru-ekran");
    e.dataset.soru = soruId;
    $("#soru-kimden").textContent = t("{0} soruyor", ad);
    $("#soru-not").textContent = t("Cevabın {0} kişisine hemen iletilir.", ad);
    e.hidden = false;
  }

  // ---------- yerel olaylar ----------
  function olayIsle(o) {
    if (!o || !o.tip) return;
    if (o.tip === "soru") {
      if (document.visibilityState === "visible") soruEkraniGoster(o.soruId, o.ad);
    } else if (o.tip === "cevap") {
      delete kurulanAlarmlar[o.soruId];
      yaz("alarmlar", kurulanAlarmlar);
      if (document.visibilityState === "visible") {
        const m = { iyi: "{0} iyi 💚", sonra: "{0} sonra arayacak", yardim: "{0} YARDIM İSTİYOR" }[o.cevap] || "{0} cevap verdi";
        tost(t(m, o.ad), 4000);
      }
    } else if (o.tip === "durum") {
      if (document.visibilityState === "visible") {
        const m = { iyi: "{0} iyi olduğunu bildirdi 💚", sonra: "{0} müsait olmadığını bildirdi", yardim: "{0} YARDIM İSTİYOR" }[o.cevap] || "{0} durum bildirdi";
        tost(t(m, o.ad), 4000);
      }
    } else if (o.tip === "eklendi") {
      tost(`${o.ad} seni ekledi`);
      sayfaKapat();
    } else if (o.tip === "hediye") {
      tamDegisti(true);
      tost(t("{0} sana İyiyim Tam hediye etti 🎁", o.ad), 5000);
    } else if (o.tip === "hediyeKullanildi") {
      tost(t("Hediyen ulaştı 🎁 {0} kodu kullandı", o.ad), 5000);
    }
    yenile();
  }

  async function bekleyenOlaylar() {
    try {
      const v = await Iyiyim.olaylariAl();
      const olaylar = v.olaylar || [];
      // Bildirimden zaten cevaplanmış soruları tekrar gösterme
      const cevaplanan = new Set(olaylar.filter((o) => o.tip === "cevaplandi").map((o) => o.soruId));
      olaylar.filter((o) => !(o.tip === "soru" && cevaplanan.has(o.soruId))).forEach(olayIsle);
    } catch (e) {}
  }

  // ---------- alt sayfalar ----------
  let acikSayfa = null;
  function sayfaAc(id) {
    sayfaKapat();
    acikSayfa = $(id);
    $("#perde").hidden = false;
    acikSayfa.hidden = false;
  }
  function sayfaKapat() {
    if (acikSayfa) acikSayfa.hidden = true;
    acikSayfa = null;
    $("#perde").hidden = true;
  }
  $("#perde").addEventListener("click", sayfaKapat);

  // Aşağı kaydırarak kapatma
  $$(".alt-sayfa").forEach((s) => {
    let y0 = null;
    s.addEventListener("touchstart", (e) => { if (s.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
    s.addEventListener("touchmove", (e) => {
      if (y0 === null) return;
      const dy = e.touches[0].clientY - y0;
      if (dy > 0) s.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    s.addEventListener("touchend", (e) => {
      if (y0 === null) return;
      const dy = e.changedTouches[0].clientY - y0;
      s.style.transform = "";
      y0 = null;
      if (dy > 110) sayfaKapat();
    });
  });

  // --- kişi ekle ---
  let davet = oku("davet", null);
  async function davetGetir(yeni) {
    const kutu = $("#kod-kutu");
    if (!yeni && davet && davet.bitis > Date.now() + 60000) { kutu.textContent = davet.kod; return; }
    kutu.textContent = "······";
    try {
      davet = await istek("/davet", {});
      if (!davet || !davet.kod) throw new Error(t("Kod alınamadı, tekrar dene"));
      yaz("davet", davet);
      kutu.textContent = davet.kod;
    } catch (e) {
      kutu.textContent = "——";
      tost(e.message);
    }
  }
  $("#kisi-ekle").addEventListener("click", () => { sekmeSec("paylas"); sayfaAc("#sayfa-ekle"); davetGetir(false); });
  $("#kod-yenile").addEventListener("click", () => davetGetir(true));
  function sekmeSec(ad) {
    $$(".sekme-dugme").forEach((b) => b.classList.toggle("secili", b.dataset.sekme === ad));
    $$(".sekme-icerik").forEach((c) => (c.hidden = c.dataset.icerik !== ad));
    if (ad === "gir") setTimeout(() => $("#kod-girdi").focus(), 80);
  }
  $$(".sekme-dugme").forEach((b) => b.addEventListener("click", () => sekmeSec(b.dataset.sekme)));

  const davetMetni = () => t("İyiyim'de birbirimizi ekleyelim. Uygulamayı açıp “Kişi ekle > Kod gir” kısmına bu kodu yaz: {0}", davet.kod);
  $("#kod-paylas").addEventListener("click", async () => {
    if (!davet) return;
    try {
      if (PaylasP) await PaylasP.share({ title: "İyiyim", text: davetMetni(), dialogTitle: t("Kodu gönder") });
      else if (navigator.share) await navigator.share({ text: davetMetni() });
      else throw 0;
    } catch (e) { kopyala(davetMetni()); }
  });
  $("#kod-kopyala").addEventListener("click", () => davet && kopyala(davet.kod));
  async function kopyala(metin) {
    try { await navigator.clipboard.writeText(metin); tost(t("Kopyalandı")); }
    catch (e) { tost(t("Kopyalanamadı, kodu basılı tutup seç")); }
  }

  $("#kod-girdi").addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 6);
  });
  $("#kod-ekle").addEventListener("click", async () => {
    const kod = $("#kod-girdi").value;
    if (kod.length !== 6) { tost(t("Kod 6 karakter olmalı")); return; }
    const b = $("#kod-ekle");
    b.disabled = true;
    try {
      const v = await istek("/katil", { kod });
      $("#kod-girdi").value = "";
      sayfaKapat();
      tost(`${v.kisi.ad} eklendi`);
      yenile();
    } catch (e) { tost(e.message); }
    finally { b.disabled = false; }
  });

  // --- kişi ayrıntısı ---
  let seciliKisi = null;
  function kisiAc(id) {
    const k = ((veri && veri.kisiler) || []).find((x) => x.id === id);
    if (!k) return;
    seciliKisi = k;
    $("#kisi-baslik").textContent = k.ad;
    $("#kisi-telefon").value = telefonlar[k.id] || "";
    ulasDugmeleri(telefonlar[k.id] || "");
    const kt = $("#kisi-tam"), kh = $("#kisi-hediye");
    kt.hidden = false;
    if (k.tam) {
      kt.innerHTML = `<b>${kacis(t("İyiyim Tam"))}</b> · ${kacis(t("{0} da sana “İyi mi?” diye sorabiliyor.", k.ad))}`;
      kh.hidden = true;
    } else {
      kt.textContent = t("{0} şu an sana sadece cevap verebiliyor. Tam hediye edersen o da sana sorabilir, cevap gelmezse alarmı çalar.", k.ad);
      kh.hidden = false;
      $("#kisi-hediye-yazi").textContent = t("{0} için Tam hediye et · {1}", k.ad, fiyat(URUN_HEDIYE));
    }
    sayfaAc("#sayfa-kisi");
  }
  $("#kisi-hediye").addEventListener("click", () => { if (seciliKisi) hediyeAc(seciliKisi.id); });
  $("#kisi-kaydet").addEventListener("click", () => {
    if (!seciliKisi) return;
    const t = $("#kisi-telefon").value.trim();
    if (t) telefonlar[seciliKisi.id] = t; else delete telefonlar[seciliKisi.id];
    yaz("telefonlar", telefonlar);
    Iyiyim.telefonlar({ liste: telefonlar }).catch(() => {});
    sayfaKapat();
    tost("Kaydedildi");
    ciz();
  });
  let cikarOnay = false;
  $("#kisi-cikar").addEventListener("click", async () => {
    if (!seciliKisi) return;
    const b = $("#kisi-cikar");
    if (!cikarOnay) { cikarOnay = true; b.textContent = t("Emin misin? Tekrar dokun"); setTimeout(() => { cikarOnay = false; b.textContent = t("Listeden çıkar"); }, 3500); return; }
    cikarOnay = false;
    b.textContent = t("Listeden çıkar");
    try {
      await istek("/kisi-sil", { id: seciliKisi.id });
      delete telefonlar[seciliKisi.id];
      yaz("telefonlar", telefonlar);
      sayfaKapat();
      tost(t("{0} çıkarıldı", seciliKisi.ad));
      yenile();
    } catch (e) { tost(e.message); }
  });

  function uluslararasi(tel) {
    let d = String(tel || "").replace(/[^0-9]/g, "");
    if (d.startsWith("00")) d = d.slice(2);
    else if (d.length === 11 && d.startsWith("0")) d = "90" + d.slice(1);
    else if (d.length === 10 && d.startsWith("5")) d = "90" + d;
    return d.length >= 10 ? d : "";
  }
  function ulasDugmeleri(tel) {
    const temiz = String(tel || "").replace(/[^0-9+]/g, "");
    $("#kisi-ulas").hidden = !temiz;
    $("#kisi-ara").href = "tel:" + temiz;
    const wp = uluslararasi(tel);
    $("#kisi-wp").hidden = !wp;
    $("#kisi-wp").href = "https://wa.me/" + wp;
  }
  $("#kisi-telefon").addEventListener("input", (e) => ulasDugmeleri(e.target.value));

  // --- herkese "İyiyim" ---
  let herkeseOnay = false;
  $("#herkese").addEventListener("click", async () => {
    const b = $("#herkese");
    if (tamYok()) { tamAc(t("Kimse sormadan tüm yakınlarına tek dokunuşla “İyiyim” demek İyiyim Tam ile açılır.")); return; }
    if (!herkeseOnay) {
      herkeseOnay = true;
      b.classList.add("onay");
      b.querySelector("span").textContent = "Emin misin? Tekrar dokun";
      setTimeout(() => { herkeseOnay = false; b.classList.remove("onay"); b.querySelector("span").textContent = t("Herkese “İyiyim” de"); }, 3500);
      return;
    }
    herkeseOnay = false;
    b.classList.remove("onay");
    b.querySelector("span").textContent = t("Herkese “İyiyim” de");
    b.disabled = true;
    try {
      const v = await istek("/herkese", { cevap: "iyi" });
      tost(t("{0} kişiye “İyiyim” gönderildi", v.kisi));
      if ("vibrate" in navigator) navigator.vibrate(20);
      yenile();
    } catch (e) {
      if (e.durum === 402 && e.veri && e.veri.tamGerekli) { tamDegisti(false); tamAc(t("Herkese “İyiyim” demek İyiyim Tam ile açılır.")); }
      else if (e.durum === 429 && e.veri && e.veri.kalan) tost(t("Az önce bildirdin. {0} sonra tekrar gönderebilirsin", kalanMetin(e.veri.kalan)));
      else tost(e.message);
    } finally { b.disabled = false; }
  });

  // --- yardım iste: tüm yakınlara konumla birlikte ---
  let yardimOnay = false;
  $("#yardim-iste").addEventListener("click", async () => {
    const b = $("#yardim-iste");
    const yazi = b.querySelector("span");
    if (!yardimOnay) {
      yardimOnay = true;
      b.classList.add("onay");
      yazi.textContent = t("Göndermek için tekrar dokun");
      if ("vibrate" in navigator) navigator.vibrate(40);
      setTimeout(() => { if (!yardimOnay) return; yardimOnay = false; b.classList.remove("onay"); yazi.textContent = t("Yardım iste"); }, 4000);
      return;
    }
    yardimOnay = false;
    b.disabled = true;
    yazi.textContent = t("Konum alınıyor…");
    let konum = null;
    try {
      const k = await Iyiyim.konumAl();
      if (k && isFinite(k.lat) && isFinite(k.lng)) konum = k;
    } catch (e) {}
    yazi.textContent = t("Gönderiliyor…");
    try {
      const v = await istek("/herkese", konum ? { cevap: "yardim", konum } : { cevap: "yardim" });
      tost(konum ? t("Yardım isteğin ve konumun {0} kişiye gönderildi", v.kisi) : t("Yardım isteğin {0} kişiye gönderildi (konum alınamadı)", v.kisi), 4500);
      if ("vibrate" in navigator) navigator.vibrate([60, 60, 60]);
      yenile();
    } catch (e) {
      tost(e.ag ? t("İnternet yok. Bağlanınca tekrar dene ya da 112'yi ara.") : e.message, 5000);
    } finally {
      b.disabled = false;
      b.classList.remove("onay");
      yazi.textContent = t("Yardım iste");
    }
  });

  // --- gizlilik ---
  $("#gizlilik-tam").href = window.IYIYIM_GIZLILIK || "#";
  document.addEventListener("click", (e) => {
    const g = e.target.closest("[data-gizlilik]");
    if (!g) return;
    e.preventDefault();
    sayfaAc("#sayfa-gizlilik");
  });

  // --- marka rehberi ---
  let cihazBilgi = null;
  async function cihazAl() {
    if (!cihazBilgi) cihazBilgi = await Iyiyim.cihaz().catch(() => ({ marka: "", model: "" }));
    return cihazBilgi;
  }
  function markaGrubu(m) {
    m = String(m || "").toLowerCase();
    if (/xiaomi|redmi|poco/.test(m)) return "xiaomi";
    if (/samsung/.test(m)) return "samsung";
    if (/oppo|realme|oneplus/.test(m)) return "oppo";
    if (/vivo|iqoo/.test(m)) return "vivo";
    if (/huawei|honor/.test(m)) return "huawei";
    return "diger";
  }
  const MARKA_ADIMLARI = {
    xiaomi: [
      ["Otomatik başlatma", "İyiyim'in yanındaki anahtarı aç.", "otomatik"],
      ["Pil tasarrufu", "Pil tasarrufu → <b>Kısıtlama yok</b> seç.", "pil"],
      ["Diğer izinler", "<b>Arka planda çalışırken açılır pencereler</b> ve <b>Kilit ekranında göster</b> izinlerini aç.", "uygulama"],
      ["Kilitle", "Son uygulamalar ekranında İyiyim'e basılı tut ve <b>kilit</b> simgesine dokun.", ""],
    ],
    samsung: [
      ["Pil", "Uygulama bilgisi → Pil → <b>Kısıtlanmamış</b> seç.", "uygulama"],
      ["Uyku listesi", "Ayarlar → Pil → Arka plan kullanım sınırları → <b>Asla uyku moduna geçmeyen uygulamalar</b>'a İyiyim'i ekle.", ""],
      ["Açılır bildirim", "Bildirimler → Gelen sorular → <b>Açılır pencere olarak göster</b>.", "sesli"],
    ],
    oppo: [
      ["Otomatik başlatma", "İyiyim için otomatik başlatmayı aç.", "otomatik"],
      ["Pil", "Uygulama bilgisi → Pil kullanımı → <b>Arka planda etkinliğe izin ver</b>.", "uygulama"],
      ["Kilitle", "Son uygulamalarda İyiyim'in menüsünden <b>Kilitle</b>.", ""],
    ],
    vivo: [
      ["Otomatik başlatma", "İyiyim için otomatik başlatmayı aç.", "otomatik"],
      ["Arka planda güç", "Pil → <b>Arka planda yüksek güç tüketimi</b> → İyiyim'e izin ver.", "uygulama"],
      ["Kilitle", "Son uygulamalarda İyiyim'i aşağı çekip kilitle.", ""],
    ],
    huawei: [
      ["Uygulama başlatma", "İyiyim → <b>Manuel yönet</b> → üç anahtarın üçünü de aç.", "otomatik"],
      ["Pil", "Pil optimizasyonunu İyiyim için kapat.", "pil"],
    ],
    diger: [
      ["Pil", "Uygulama bilgisi → Pil → <b>Kısıtlanmamış</b> seç.", "uygulama"],
      ["Açılır bildirim", "Gelen sorular için ses ve açılır pencereyi aç.", "sesli"],
    ],
  };
  async function markaRehberi(hedef) {
    const d = await cihazAl();
    const grup = markaGrubu(d.marka);
    const ad = [d.marka, d.model].filter(Boolean).join(" ") || t("Telefonun");
    const adimlar = MARKA_ADIMLARI[grup];
    const kutu = $(hedef);
    kutu.innerHTML = `<h3>${kacis(ad)}<small>${t("Bu telefonlarda bildirimlerin arka planda gelmesi için şunları aç:")}</small></h3>` +
      adimlar.map((s, i) => `<div class="marka-adim"><span class="no">${i + 1}</span><div><b>${t(s[0])}</b><br>${t(s[1])}${s[2] ? `<br><button class="dugme dugme-ikincil" data-marka-izin="${s[2]}">${t("Ayarı aç")}</button>` : ""}</div></div>`).join("");
    const alt = $("#marka-alt");
    if (alt) alt.textContent = ad;
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-marka-izin]");
    if (!b) return;
    const t = b.dataset.markaIzin;
    if (t === "otomatik") { const r = await Iyiyim.otomatikBaslatma().catch(() => ({})); if (!r.ozel) tost(t("Uygulama ayarları açıldı. “Otomatik başlatma”yı orada ara.")); }
    else izinIste(t, null);
  });
  $("#marka-ac").addEventListener("click", () => { markaRehberi("#ayar-marka"); sayfaAc("#sayfa-marka"); });

  // --- bildirim denemesi ---
  function kontrolSatiri(durum, baslik, metin) {
    const isaret = { ok: "✓", hata: "✕", bekle: t("…") }[durum];
    return `<li class="${durum}"><span class="i">${isaret}</span><div><b>${kacis(baslik)}</b>${metin ? `<span>${kacis(metin)}</span>` : ""}</div></li>`;
  }
  async function bildirimDene(gecikme) {
    const liste = $("#deneme-liste");
    const satirlar = [];
    const yaz2 = () => (liste.innerHTML = satirlar.join(""));
    $("#deneme-simdi").disabled = $("#deneme-kapali").disabled = true;
    try {
      // 1) izin
      const iz = await Iyiyim.izinDurumu().catch(() => ({}));
      satirlar.push(iz.bildirim ? kontrolSatiri("ok", t("Bildirim izni açık")) : kontrolSatiri("hata", t("Bildirim izni kapalı"), t("Ayarlar → Bildirim izni")));
      yaz2();
      // 2) telefon jetonu
      const j = await Iyiyim.jetonAl().catch((e) => ({ token: "", hata: e.message }));
      if (!j.token) {
        satirlar.push(kontrolSatiri("hata", t("Telefon bildirim kimliği alamadı"), j.hata || t("Google Play Hizmetleri güncel mi, internet var mı?")));
        yaz2();
        return;
      }
      satirlar.push(kontrolSatiri("ok", t("Telefonun bildirim kimliği hazır")));
      yaz2();
      // 3) sunucuya kaydet
      await istek("/guncelle", { token: j.token });
      kimlik.token = j.token; yaz("kimlik", kimlik);
      satirlar.push(kontrolSatiri("ok", "Sunucuya kaydedildi"));
      yaz2();
      // 4) sunucudan gönder
      const r = await istek("/deneme", { gecikme: gecikme || 0 });
      if (r.proje && window.IYIYIM_FIREBASE && r.proje !== window.IYIYIM_FIREBASE) {
        satirlar.push(kontrolSatiri("hata", t("Sunucu başka bir Firebase projesine bağlı"), `Sunucu: ${r.proje}, uygulama: ${window.IYIYIM_FIREBASE}`));
      } else if (r.ok) {
        satirlar.push(kontrolSatiri("ok", gecikme ? t("Gönderim planlandı") : t("Sunucu bildirimi gönderdi"), gecikme ? t("Şimdi uygulamadan çık. 15 saniye içinde “Bildirimler çalışıyor ✓” gelmeli.") : t("Birkaç saniye içinde “Bildirimler çalışıyor ✓” bildirimi gelmeli.")));
        satirlar.push(kontrolSatiri("bekle", "Gelmezse", t("Sorun telefonda: yukarıdaki “Telefonuna özel ayarlar”ı yap.")));
      } else {
        satirlar.push(kontrolSatiri("hata", t("Sunucu bildirimi gönderemedi"), r.gonderim));
      }
      yaz2();
    } catch (e) {
      satirlar.push(kontrolSatiri("hata", t("Sunucuya ulaşılamadı"), e.durum === 404 ? t("Sunucu kodu eski: Cloudflare'deki worker.js güncellenmeli") : e.message));
      yaz2();
    } finally {
      $("#deneme-simdi").disabled = $("#deneme-kapali").disabled = false;
    }
  }
  $("#deneme-ac").addEventListener("click", () => { $("#deneme-liste").innerHTML = ""; sayfaAc("#sayfa-deneme"); bildirimDene(0); });
  $("#deneme-simdi").addEventListener("click", () => bildirimDene(0));
  $("#deneme-kapali").addEventListener("click", () => bildirimDene(15));

  // --- bildirim tonu ---
  $("#ayar-ton").addEventListener("change", async (e) => {
    ayar.ton = e.target.value; yaz("ayar", ayar);
    await Iyiyim.tonSec({ ton: ayar.ton }).catch(() => {});
    Iyiyim.tonDinle({ ton: ayar.ton }).catch(() => {});
    tost(`Bildirim tonu: ${e.target.selectedOptions[0].textContent}`);
  });
  $("#ton-dinle").addEventListener("click", () => Iyiyim.tonDinle({ ton: $("#ayar-ton").value }).catch(() => {}));

  // --- geliştiriciyi destekle ---
  const surumYaz = () => ($("#alt-surum").textContent = t("Sürüm {0}", window.IYIYIM_SURUM || ""));
  surumYaz();
  $("#destek-ac").addEventListener("click", async () => {
    sayfaAc("#sayfa-destek");
    fiyatlariAl();
  });
  $("#destek-ol").addEventListener("click", async () => {
    const b = $("#destek-ol");
    b.disabled = true;
    try {
      const r = await Iyiyim.destekOl();
      if (r.durum === "tamam" || r.durum === "tesekkurler") {
        $("#destek-baslik").textContent = t("Teşekkür ederim 💚");
        $("#destek-metin").innerHTML = `<p>${kacis(t("Desteğin ulaştı. Bugün birinin “İyiyim” diyebilmesine sen de katkı verdin."))}</p><p>${kacis(t("Bu uygulamayı her geliştirdiğimde aklımda olacaksın."))}</p>`;
        b.hidden = true;
        $("#destek-not").textContent = "— matali";
      } else if (r.durum === "iptal") {
        tost(t("Sorun değil, İyiyim seninle 💚"));
      } else if (r.mesaj) {
        tost(r.mesaj, 4000);
      }
    } catch (e) { tost(t("Ödeme başlatılamadı")); }
    finally { b.disabled = false; }
  });

  // ---------- İyiyim Tam ve hediye ----------
  const URUN_TAM = "iyiyim_tam", URUN_HEDIYE = "iyiyim_hediye", URUN_DESTEK = "destek_149";
  const PLAY_LINK = "https://play.google.com/store/apps/details?id=com.matali.iyiyim";
  let fiyatlar = oku("fiyatlar", {});
  let bekleyenHediyeler = oku("bekleyenHediye", {}); // satın alma jetonu -> kime ("" = kod olarak)
  // Sunucudan bilgi gelmeden kimseyi kilitleme; sunucu zaten her istekte kontrol eder
  function tamYok() { return !!(veri && veri.ben && veri.ben.tam === false); }
  const fiyat = (u) => fiyatlar[u] || (u === URUN_DESTEK ? "149,99 ₺" : "99,99 ₺");

  async function fiyatlariAl() {
    const r = await Iyiyim.urunFiyatlari({ urunler: [URUN_TAM, URUN_HEDIYE, URUN_DESTEK] }).catch(() => ({}));
    if (r && r.fiyatlar && Object.keys(r.fiyatlar).length) {
      fiyatlar = Object.assign({}, fiyatlar, r.fiyatlar);
      yaz("fiyatlar", fiyatlar);
    }
    fiyatlariYaz();
  }
  function fiyatlariYaz() {
    $("#tam-al").textContent = t("{0} · Satın al", fiyat(URUN_TAM));
    $("#hediye-al").textContent = t("{0} ile hediye et", fiyat(URUN_HEDIYE));
    const d = $("#destek-ol");
    if (!d.hidden) d.textContent = t("{0} ile destekle", fiyat(URUN_DESTEK));
  }

  function tamDegisti(var_) {
    if (veri && veri.ben) { veri.ben.tam = !!var_; yaz("onbellek", veri); }
    tamGoster();
    ciz();
  }
  function tamGoster() {
    const tam = !tamYok();
    $("#tam-baglanti").hidden = !(veri && veri.ben) || tam;
    const d = $("#ayar-tam-durum");
    d.textContent = tam ? t("Açık ✓") : fiyat(URUN_TAM);
    d.className = tam ? "tamam" : "";
    $("#ayar-tam-alt").textContent = tam ? t("Bütün özellikler açık. Teşekkürler!") : t("Sor, alarm kur, herkese “İyiyim” de");
  }

  function tamAc(neden) {
    $("#tam-neden").textContent = neden || t("Sevdiklerinin iyi olduğundan bir dokunuşla emin ol.");
    fiyatlariYaz();
    sayfaAc("#sayfa-tam");
    fiyatlariAl();
  }
  $("#tam-baglanti").addEventListener("click", () => tamAc());
  $("#ayar-tam").addEventListener("click", () => { if (tamYok()) tamAc(); else tost(t("İyiyim Tam açık ★ Desteğin için teşekkürler")); });
  $("#ayar-hediye").addEventListener("click", () => hediyeAc());
  $("#ayar-kod").addEventListener("click", () => kodAc());
  $("#tam-hediye-ac").addEventListener("click", () => hediyeAc());
  $("#tam-kod-ac").addEventListener("click", () => kodAc());

  function odemeHatasi(r) {
    if (!r || r.durum === "iptal") return;
    tost(r.mesaj || t("Ödeme tamamlanamadı"), 4500);
  }

  $("#tam-al").addEventListener("click", async () => {
    const b = $("#tam-al");
    b.disabled = true;
    try {
      const r = await Iyiyim.satinAl({ urun: URUN_TAM, hesap: kimlik ? kimlik.id : "" });
      if (r.durum === "tamam" && r.token) {
        if (await tamSunucuya(r.token, true)) tamKutla();
      } else odemeHatasi(r);
    } catch (e) { tost(t("Ödeme başlatılamadı")); }
    finally { b.disabled = false; }
  });

  /** Satın alma jetonunu sunucuya bildirir. Sunucu jetonu Google Play'e doğrulatır. */
  async function tamSunucuya(token, sesli) {
    try {
      await istek("/tam", { token });
      tamDegisti(true);
      return true;
    } catch (e) {
      if (sesli) {
        if (e.ag) tost(t("İnternet yok. Ödemen güvende; bağlanınca kendiliğinden açılacak."), 5000);
        else if (e.veri && e.veri.tekrar) tost(t("Ödemen alındı, Google onaylıyor. Birkaç dakika içinde kendiliğinden açılacak."), 6000);
        else tost(e.message, 5000);
      }
      return false;
    }
  }
  function tamKutla() {
    sayfaKapat();
    if ("vibrate" in navigator) navigator.vibrate([30, 40, 30]);
    const tamsiz = ((veri && veri.kisiler) || []).filter((k) => !k.tam);
    if (tamsiz.length) {
      hediyeAc(tamsiz[0].id, t("★ İyiyim Tam açıldı!"));
      $("#hediye-secim .ipucu").textContent = t("Teşekkürler! Artık istediğin kadar sorabilirsin. {0} da sana sorabilsin ister misin? Ona da hediye edebilirsin.", tamsiz[0].ad);
    } else {
      tost(t("★ İyiyim Tam açıldı. Teşekkürler!"), 4000);
    }
  }

  /** Play'deki satın almaları sunucuyla eşitler: geri yükleme ve yarım kalan hediyeler. */
  let esitleniyor = null;
  function odemeleriEsitle(elle) {
    if (!kimlik) return Promise.resolve();
    if (esitleniyor) return esitleniyor;
    esitleniyor = (async () => {
      const o = await Iyiyim.sahipOlunanlar().catch(() => ({})) || {};
      let bulundu = false;
      if (o[URUN_TAM]) {
        bulundu = true;
        if (tamYok() || elle) {
          const ok = await tamSunucuya(o[URUN_TAM], elle);
          if (ok && elle) tost(t("İyiyim Tam geri yüklendi ★"), 4000);
        }
      }
      for (const t of o[URUN_HEDIYE + "_liste"] || []) {
        bulundu = true;
        await hediyeSunucuya(t, bekleyenHediyeler[t] || "", false);
      }
      if (elle && !bulundu) tost(yerel ? t("Bu Google hesabında İyiyim Tam satın alımı bulunamadı") : t("Geri yükleme Play Store sürümünde çalışır"), 4500);
    })().finally(() => { esitleniyor = null; });
    return esitleniyor;
  }
  $("#tam-geri").addEventListener("click", async () => {
    const b = $("#tam-geri");
    b.disabled = true;
    try { await odemeleriEsitle(true); if (!tamYok()) sayfaKapat(); } finally { b.disabled = false; }
  });

  // --- hediye et ---
  let hediyeKime = "";
  function hediyeAc(kisiId, baslik) {
    const liste = (veri && veri.kisiler) || [];
    hediyeKime = kisiId !== undefined ? kisiId : ((liste.find((k) => !k.tam) || {}).id || "");
    $("#hediye-baslik").textContent = baslik || t("İyiyim Tam hediye et");
    $("#hediye-secim .ipucu").textContent = t("Annen, baban ya da bir yakının da sana “İyi mi?” diye sorabilsin, alarm kurabilsin. Ödemeyi sen yaparsın, onun hiçbir şey yapması gerekmez.");
    $("#hediye-secim").hidden = false;
    $("#hediye-sonuc").hidden = true;
    hediyeListesiCiz();
    fiyatlariYaz();
    sayfaAc("#sayfa-hediye");
    fiyatlariAl();
  }
  function hediyeListesiCiz() {
    const liste = (veri && veri.kisiler) || [];
    $("#hediye-liste").innerHTML = liste.map((k) => `
      <button class="hediye-secenek${hediyeKime === k.id ? " secili" : ""}" data-hk="${kacis(k.id)}"${k.tam ? " disabled" : ""}>
        <span class="nokta"></span><span>${kacis(k.ad)}<small>${kacis(k.tam ? t("Zaten İyiyim Tam kullanıyor") : t("Hemen açılır, ona bildirim gider"))}</small></span>
      </button>`).join("") + `
      <button class="hediye-secenek${hediyeKime === "" ? " secili" : ""}" data-hk="">
        <span class="nokta"></span><span>${kacis(t("Kod olarak al"))}<small>${kacis(t("Listende olmayan birine WhatsApp'tan gönder"))}</small></span>
      </button>`;
  }
  $("#hediye-liste").addEventListener("click", (e) => {
    const b = e.target.closest("[data-hk]");
    if (!b || b.disabled) return;
    hediyeKime = b.dataset.hk;
    hediyeListesiCiz();
  });
  $("#hediye-al").addEventListener("click", async () => {
    const b = $("#hediye-al");
    b.disabled = true;
    try {
      await odemeleriEsitle(false); // yarım kalmış bir hediye varsa önce onu tamamla
      const r = await Iyiyim.satinAl({ urun: URUN_HEDIYE, hesap: kimlik ? kimlik.id : "" });
      if (r.durum === "tamam" && r.token) {
        bekleyenHediyeler[r.token] = hediyeKime;
        yaz("bekleyenHediye", bekleyenHediyeler);
        await hediyeSunucuya(r.token, hediyeKime, true);
      } else odemeHatasi(r);
    } catch (e) { tost(t("Ödeme başlatılamadı")); }
    finally { b.disabled = false; }
  });

  async function hediyeSunucuya(token, kime, sesli) {
    try {
      const v = await istek("/hediye", kime ? { token, kime } : { token });
      delete bekleyenHediyeler[token];
      yaz("bekleyenHediye", bekleyenHediyeler);
      Iyiyim.tuket({ token }).catch(() => {});
      if (sesli) hediyeSonucGoster(v);
      else if (!v.tekrar) tost(v.kime ? t("Hediyen ulaştı 🎁 {0} artık İyiyim Tam kullanıyor", v.kime) : t("Hediye kodun hazır: {0} (Ayarlar > Verdiğim hediyeler)", v.kod), 6000);
      yenile();
      return true;
    } catch (e) {
      // Kişi bu arada listeden çıktıysa hediye boşa gitmesin: kod olarak al
      if (kime && e.durum === 404) return hediyeSunucuya(token, "", sesli);
      if (sesli) {
        if (e.ag) tost(t("İnternet yok. Ödemen güvende; bağlanınca hediye kendiliğinden gönderilecek."), 5000);
        else if (e.veri && e.veri.tekrar) tost(t("Ödemen alındı, Google onaylıyor. Onaylanınca hediye kendiliğinden gönderilecek."), 6000);
        else tost(e.message, 5000);
      }
      return false;
    }
  }
  let sonHediyeKodu = "";
  function hediyeSonucGoster(v) {
    $("#hediye-secim").hidden = true;
    $("#hediye-sonuc").hidden = false;
    $("#hediye-baslik").textContent = t("Hediyen hazır");
    sonHediyeKodu = v.kod && !v.kime ? v.kod : "";
    if (v.kime) {
      $("#hediye-sonuc-metin").textContent = t("{0} artık İyiyim Tam kullanıyor. Ona bildirim gitti; o da sana “İyi mi?” diye sorabilir.", v.kime);
    } else if (v.zatenTam) {
      $("#hediye-sonuc-metin").textContent = t("{0} bu arada zaten Tam olmuş. Hediyen boşa gitmesin diye kod olarak hazırlandı; başka bir yakınına gönderebilirsin.", v.zatenTam);
    } else {
      $("#hediye-sonuc-metin").textContent = t("Kodu gönder. Uygulamayı kurup Ayarlar > “Hediye kodum var” kısmına yazması yeterli.");
    }
    $("#hediye-kod").hidden = !sonHediyeKodu;
    $("#hediye-kod").textContent = sonHediyeKodu;
    $("#hediye-paylas").hidden = !sonHediyeKodu;
  }
  const hediyeMetni = (kod) => t("Sana İyiyim Tam hediye ettim 🎁 Play Store'dan İyiyim'i indir: {0} Sonra Ayarlar > “Hediye kodum var” kısmına bu kodu yaz: {1}", PLAY_LINK, kod);
  async function kodPaylas(kod) {
    try {
      if (PaylasP) await PaylasP.share({ title: t("İyiyim Tam hediye"), text: hediyeMetni(kod), dialogTitle: t("Hediye kodunu gönder") });
      else if (navigator.share) await navigator.share({ text: hediyeMetni(kod) });
      else throw 0;
    } catch (e) { kopyala(hediyeMetni(kod)); }
  }
  $("#hediye-paylas").addEventListener("click", () => sonHediyeKodu && kodPaylas(sonHediyeKodu));
  $("#hediye-tamam").addEventListener("click", sayfaKapat);

  // --- hediye kodu gir ---
  function kodAc() {
    $("#hediye-kod-girdi").value = "";
    sayfaAc("#sayfa-kod");
    setTimeout(() => $("#hediye-kod-girdi").focus(), 80);
  }
  $("#hediye-kod-kullan").addEventListener("click", async () => {
    const kod = $("#hediye-kod-girdi").value.toUpperCase().replace(/[^0-9A-Z]/g, "");
    if (kod.length !== 8) { tost(t("Kod H ile başlayan 8 karakter olmalı")); return; }
    const b = $("#hediye-kod-kullan");
    b.disabled = true;
    try {
      const v = await istek("/hediye-kullan", { kod });
      tamDegisti(true);
      sayfaKapat();
      tost(v.veren ? t("{0} sana İyiyim Tam hediye etti 🎁", v.veren) : t("İyiyim Tam açıldı 🎁"), 5000);
      yenile();
    } catch (e) { tost(e.message, 4500); }
    finally { b.disabled = false; }
  });
  $("#hediye-kod-girdi").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#hediye-kod-kullan").click(); });

  // --- verdiğim hediyeler ---
  $("#ayar-hediyelerim").addEventListener("click", async () => {
    const l = $("#hediyelerim-liste");
    l.innerHTML = `<p class="ipucu">${kacis(t("Yükleniyor…"))}</p>`;
    sayfaAc("#sayfa-hediyelerim");
    try {
      const v = await istek("/hediyelerim");
      const h = v.hediyeler || [];
      l.innerHTML = h.length ? h.map((x) => {
        const durum = x.iptal ? t("İade edildi") : x.kullanan ? t("{0} kullanıyor", x.kullanan) : t("Henüz kullanılmadı · dokun, gönder");
        return `<button class="ayar-satir" data-hkod="${x.iptal || x.kullanan ? "" : kacis(x.kod)}"><span>${kacis(x.kod)}<small>${kacis(durum)}</small></span><em>${x.kullanan ? "✓" : x.iptal ? "" : kacis(t("Gönder"))}</em></button>`;
      }).join("") : `<p class="ipucu">${kacis(t("Henüz hediye vermedin."))}</p>`;
    } catch (e) { l.innerHTML = `<p class="ipucu">${kacis(e.message)}</p>`; }
  });
  $("#hediyelerim-liste").addEventListener("click", (e) => {
    const b = e.target.closest("[data-hkod]");
    if (b && b.dataset.hkod) kodPaylas(b.dataset.hkod);
  });

  function tamIstegiBak() {
    Iyiyim.tamIstegi().then((r) => {
      if (r && r.goster && tamYok()) tamAc(t("Ana ekrandaki “İyiyim” düğmesi İyiyim Tam ile çalışır."));
    }).catch(() => {});
  }

  // ---------- dil seçimi ----------
  function dilDegistir(d) {
    if (!DILLER.includes(d)) return;
    aktifDil = d;
    ayar.dil = d;
    yaz("ayar", ayar);
    sayfayiCevir();
    Iyiyim.dilAyarla({ dil: d }).catch(() => {});
    surumYaz();
    fiyatlariYaz();
    tamGoster();
    ciz();
    if (acikSayfa && acikSayfa.id === "sayfa-ayar") ayarlariDoldur();
    if (acikSayfa && acikSayfa.id === "sayfa-gecmis") gecmisCiz();
  }
  $("#dil-karsilama").addEventListener("change", (e) => dilDegistir(e.target.value));
  $("#ayar-dil").addEventListener("change", (e) => dilDegistir(e.target.value));

  // ---------- bildirim geçmişi (son 24 saat) ----------
  let gecmisVeri = null;
  const GECMIS_IKON = {
    iyi: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    sonra: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    yardim: '<svg viewBox="0 0 24 24"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4.5M12 17.5v.01"/></svg>',
    soru: '<svg viewBox="0 0 24 24"><path d="M9.2 9a3 3 0 1 1 4.1 2.8c-.8.3-1.3 1-1.3 1.9v.6M12 17.5v.01"/><circle cx="12" cy="12" r="9"/></svg>',
    ekle: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3.5"/><path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5M18 8v6M15 11h6"/></svg>',
  };
  function gecmisSatiri(o) {
    const c = o.cevap;
    const cevapAdi = { iyi: t("İyiyim"), sonra: t("Sonra ararım"), yardim: t("Yardım lazım") }[c] || "";
    let tur = c || "soru", metin = "", alt = "";
    switch (o.tip) {
      case "sordun": tur = "soru"; metin = t("{0} kişisine “İyi mi?” diye sordun", o.ad); break;
      case "sordu": tur = "soru"; metin = t("{0} sana “İyi misin?” diye sordu", o.ad); break;
      case "cevapladi": metin = t("{0} cevap verdi: {1}", o.ad, cevapAdi); break;
      case "cevapladin": metin = t("{0} kişisine cevap verdin: {1}", o.ad, cevapAdi); break;
      case "durum": metin = c === "yardim" ? t("{0} herkesten yardım istedi", o.ad) : c === "sonra" ? t("{0} müsait olmadığını bildirdi", o.ad) : t("{0} herkese “İyiyim” dedi", o.ad); break;
      case "durumun": metin = c === "yardim" ? t("Herkesten yardım istedin") : c === "sonra" ? t("Herkese müsait olmadığını bildirdin") : t("Herkese “İyiyim” dedin"); break;
      case "eklendi": tur = "ekle"; metin = t("{0} ile eşleştiniz", o.ad); break;
      default: return "";
    }
    const z = o.zaman - saatFarki;
    alt = `${saatMetni(z)} · ${once(Date.now() - z)}`;
    const konum = o.konum && isFinite(o.konum.lat)
      ? `<a class="konum-link" href="https://www.google.com/maps/search/?api=1&query=${o.konum.lat},${o.konum.lng}">${PIN_SVG}${kacis(t("Konumu gör"))}</a>` : "";
    return `<li class="g-${tur}"><span class="g-ikon" aria-hidden="true">${GECMIS_IKON[tur] || GECMIS_IKON.soru}</span><div><b>${kacis(metin)}</b><small>${kacis(alt)}</small>${konum}</div></li>`;
  }
  function gecmisCiz() {
    const l = $("#gecmis-liste");
    if (!gecmisVeri) { l.innerHTML = `<p class="ipucu">${kacis(t("Yükleniyor…"))}</p>`; return; }
    const satirlar = gecmisVeri.map(gecmisSatiri).filter(Boolean);
    if (!satirlar.length) {
      l.innerHTML = `<div class="gecmis-bos"><p>${kacis(t("Son 24 saatte bir şey olmadı."))}</p><p class="ipucu kucuk">${kacis(t("Birine “İyi mi?” diye sorduğunda ya da biri sana sorduğunda burada görünür."))}</p></div>`;
      return;
    }
    // Günü değişen yerde ara başlık: Bugün / Dün
    let html = "", onceki = "";
    const bugun = new Date().toDateString();
    for (let i = 0; i < gecmisVeri.length; i++) {
      const o = gecmisVeri[i], r = gecmisSatiri(o);
      if (!r) continue;
      const gun = new Date(o.zaman - saatFarki).toDateString();
      if (gun !== onceki) {
        html += (onceki ? "</ol>" : "") + `<p class="gecmis-gun">${kacis(gun === bugun ? t("Bugün") : t("Dün"))}</p><ol class="gecmis-ol">`;
        onceki = gun;
      }
      html += r;
    }
    l.innerHTML = html + "</ol>";
  }
  async function gecmisAc() {
    sayfaAc("#sayfa-gecmis");
    gecmisCiz();
    try {
      const v = await istek("/gecmis");
      if (v.simdi) saatFarki = v.simdi - Date.now();
      gecmisVeri = v.olaylar || [];
      yaz("gecmis", gecmisVeri);
    } catch (e) {
      if (!gecmisVeri) gecmisVeri = (oku("gecmis", []) || []).filter((o) => o.zaman > Date.now() - 864e5);
      tost(e.ag ? t("İnternet yok gibi. Bağlanınca liste güncellenecek.") : e.message);
    }
    gecmisCiz();
  }
  $("#gecmis-ac").addEventListener("click", gecmisAc);

  // --- ayarlar ---
  function ayarlariDoldur() {
    tamGoster();
    $("#ayar-hediyelerim").hidden = !kimlik;
    $("#ayar-ad").value = kimlik ? kimlik.ad : "";
    secimleriGoster();
    $("#surum").textContent = window.IYIYIM_SURUM || "";
    izinleriGoster();
    cihazAl().then((d) => { const alt = $("#marka-alt"); if (alt) alt.textContent = [d.marka, d.model].filter(Boolean).join(" ") || t("Markana göre gereken ayarlar"); });
  }
  function secimleriGoster() {
    $("#ayar-sure").value = String(ayar.sureDk);
    $("#ayar-ton").value = ayar.ton;
    $$("#ayar-tema button").forEach((b) => b.classList.toggle("secili", b.dataset.deger === ayar.tema));
  }
  async function izinleriGoster() {
    try {
      const d = await Iyiyim.izinDurumu();
      const db = $("#durum-bildirim"), da = $("#durum-alarm");
      db.textContent = d.bildirim ? t("Açık") : t("Kapalı");
      db.className = d.bildirim ? "tamam" : "eksik";
      da.textContent = d.tamAlarm ? t("Açık") : t("Kapalı");
      da.className = d.tamAlarm ? "tamam" : "eksik";
      const dt = $("#durum-tamekran");
      dt.textContent = d.tamEkran ? t("Açık") : t("Kapalı");
      dt.className = d.tamEkran ? "tamam" : "eksik";
      $("#ayar-tamekran-satir").hidden = d.sdk < 34;
      $("#izin-tamekran-satir").hidden = d.sdk < 34;
      const dk = $("#durum-konum");
      dk.textContent = d.konum ? t("Açık") : t("Kapalı");
      dk.className = d.konum ? "tamam" : "eksik";
      const du = $("#durum-ustte");
      du.textContent = d.ustte ? t("Açık") : t("Kapalı");
      du.className = d.ustte ? "tamam" : "eksik";
      $("#ayar-alarm-satir").hidden = d.sdk < 31;
      $("#izin-alarm-satir").hidden = d.sdk < 31;
    } catch (e) {}
  }
  $("#ayarlar-ac").addEventListener("click", () => { ayarlariDoldur(); sayfaAc("#sayfa-ayar"); });
  $("#ayar-kaydet").addEventListener("click", async () => {
    const b = $("#ayar-kaydet");
    const ad = $("#ayar-ad").value.trim();
    if (!ad) { tost(t("Ad boş olamaz")); $("#ayar-ad").focus(); return; }
    b.disabled = true;
    try {
      if (kimlik && ad !== kimlik.ad) {
        const v = await istek("/guncelle", { ad });
        kimlik.ad = v.ad;
        yaz("kimlik", kimlik);
      }
      yaz("ayar", ayar);
      sayfaKapat();
      tost("Ayarlar kaydedildi");
      ciz();
    } catch (e) { tost(e.message); }
    finally { b.disabled = false; }
  });
  $("#ayar-sure").addEventListener("change", (e) => {
    ayar.sureDk = +e.target.value; yaz("ayar", ayar); ciz();
    tost(`Cevap gelmezse alarm: ${e.target.selectedOptions[0].textContent}`);
  });
  $$("#ayar-tema button").forEach((b) => b.addEventListener("click", () => {
    ayar.tema = b.dataset.deger; yaz("ayar", ayar); temaUygula(); secimleriGoster();
  }));
  let silOnay = false;
  $("#hesap-sil").addEventListener("click", async () => {
    const b = $("#hesap-sil");
    if (!silOnay) { silOnay = true; b.textContent = t("Tüm kişilerin silinecek. Emin misin?"); setTimeout(() => { silOnay = false; b.textContent = t("Hesabımı sil"); }, 4000); return; }
    try { await istek("/hesap-sil", {}); } catch (e) {}
    hesabiSifirla();
  });

  function hesabiSifirla() {
    kimlik = null; veri = null; davet = null; kurulanAlarmlar = {};
    ["kimlik", "onbellek", "davet", "alarmlar"].forEach((k) => { try { localStorage.removeItem("iyiyim." + k); } catch (e) {} });
    Iyiyim.ayarla({ sunucu: sunucu(), id: "", sifre: "" }).catch(() => {});
    sayfaKapat();
    goster("karsilama");
  }

  // --- izin düğmeleri ---
  async function izinIste(tur, dugme) {
    try {
      if (tur === "bildirim") {
        const r = await Iyiyim.bildirimIzni();
        if (r.durum === "granted" && dugme) { dugme.textContent = t("Tamam ✓"); dugme.classList.add("tamam"); }
        if (r.durum !== "granted") tost(t("İzin verilmedi. Telefon ayarlarından açabilirsin."));
      } else if (tur === "pil") {
        await Iyiyim.pilAyari();
      } else if (tur === "alarm") {
        await Iyiyim.alarmAyari();
      } else if (tur === "widget") {
        const r = await Iyiyim.widgetEkle();
        if (!r.destek) tost(t("Ana ekranda boş bir yere basılı tut → Widget'lar → İyiyim'i sürükle"), 6000);
      } else if (tur === "tamekran") {
        await Iyiyim.tamEkranAyari();
      } else if (tur === "konum") {
        const r = await Iyiyim.konumIzni();
        if (r.durum === "granted" && dugme) { dugme.textContent = t("Tamam ✓"); dugme.classList.add("tamam"); }
        if (r.durum !== "granted") tost(t("Konum izni verilmedi. Yardım isteği konumsuz gider."));
      } else if (tur === "ustte") {
        await Iyiyim.usteAyari();
      } else if (tur === "sesli") {
        await Iyiyim.bildirimAyari();
      } else if (tur === "uygulama") {
        await Iyiyim.uygulamaAyarlariAc();
      }
    } catch (e) { tost(t("Ayar açılamadı")); }
    setTimeout(izinleriGoster, 600);
  }
  $$("[data-izin]").forEach((b) => b.addEventListener("click", () => izinIste(b.dataset.izin, b)));

  // ---------- liste tıklamaları ----------
  $("#kisi-liste").addEventListener("click", (e) => {
    const kart = e.target.closest("[data-kart]");
    if (kart && e.target.closest(".ara-yuvarlak, .konum-link, [data-kisi]")) ilgilenildi(kart.dataset.kart);
    const s = e.target.closest("[data-sor]");
    if (s) return sor(s.dataset.sor, s);
    const k = e.target.closest("[data-kisi]");
    if (k) return kisiAc(k.dataset.kisi);
  });
  $("#gelen-sorular").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cevap]");
    if (!b) return;
    const kutu = b.closest("[data-soru]");
    $$("#gelen-sorular button").forEach((x) => (x.disabled = true));
    cevapla(kutu.dataset.soru, b.dataset.cevap).finally(() => $$("#gelen-sorular button").forEach((x) => (x.disabled = false)));
  });
  $$("#soru-ekran [data-cevap]").forEach((b) => b.addEventListener("click", () => cevapla($("#soru-ekran").dataset.soru, b.dataset.cevap)));

  // ---------- karşılama ----------
  function goster(ekran) {
    $("#karsilama").hidden = ekran !== "karsilama";
    $("#ana").hidden = ekran !== "ana";
    if (ekran === "karsilama") { $("#adim-ad").hidden = false; $("#adim-izin").hidden = true; }
  }

  $("#ad-devam").addEventListener("click", async () => {
    const ad = $("#ad-girdi").value.trim();
    if (!ad) { tost(t("Önce adını yaz")); $("#ad-girdi").focus(); return; }
    const b = $("#ad-devam");
    b.disabled = true; b.textContent = t("Hazırlanıyor…");
    try {
      const j = await Iyiyim.jetonAl().catch(() => ({ token: "" }));
      const v = await istek("/kayit", { ad, token: j.token || null });
      kimlik = { id: v.id, sifre: v.sifre, ad: v.ad, token: j.token || "" };
      yaz("kimlik", kimlik);
      await yerelAyarla();
      $("#adim-ad").hidden = true;
      $("#adim-izin").hidden = false;
      izinleriGoster();
      markaRehberi("#karsilama-marka");
    } catch (e) {
      tost(e.message, 4000);
    } finally {
      b.disabled = false; b.textContent = "Devam";
    }
  });
  $("#ad-girdi").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#ad-devam").click(); });
  $("#izin-bitti").addEventListener("click", () => { goster("ana"); ciz(); yenile(false); });

  // ---------- yerel tarafla eşitleme ----------
  async function yerelAyarla() {
    Iyiyim.tonSec({ ton: ayar.ton }).catch(() => {});
    await Iyiyim.ayarla({ sunucu: sunucu(), id: kimlik ? kimlik.id : "", sifre: kimlik ? kimlik.sifre : "" }).catch(() => {});
    await Iyiyim.telefonlar({ liste: telefonlar }).catch(() => {});
  }
  async function jetonuEsitle() {
    if (!kimlik) return;
    try {
      const j = await Iyiyim.jetonAl();
      if (j.token && j.token !== kimlik.token) {
        await istek("/guncelle", { token: j.token });
        kimlik.token = j.token;
        yaz("kimlik", kimlik);
      }
    } catch (e) {}
  }

  // ---------- geri tuşu ----------
  if (UygulamaP) {
    UygulamaP.addListener("backButton", () => {
      if (!$("#soru-ekran").hidden) { tost(t("Önce bir cevap seç")); return; }
      if (acikSayfa) { sayfaKapat(); return; }
      UygulamaP.minimizeApp ? UygulamaP.minimizeApp() : UygulamaP.exitApp();
    });
    UygulamaP.addListener("resume", () => { bekleyenOlaylar(); yenile(); tamIstegiBak(); });
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { bekleyenOlaylar(); yenile(); } });

  // ---------- başlat ----------
  async function baslat() {
    temaUygula();
    sayfayiCevir();
    surumYaz();
    fiyatlariYaz();
    if (!ayar.dil) {
      // İlk açılış: telefonun dili desteklenmiyorsa İngilizce
      const td = await Iyiyim.telefonDili().catch(() => ({}));
      const d = String((td && td.dil) || "").toLowerCase();
      if (DILLER.includes(d) && d !== aktifDil) { aktifDil = d; sayfayiCevir(); surumYaz(); fiyatlariYaz(); }
    }
    Iyiyim.dilAyarla({ dil: aktifDil }).catch(() => {});
    Iyiyim.addListener("olay", olayIsle);
    if (!kimlik) { goster("karsilama"); return; }
    goster("ana");
    ciz();
    await yerelAyarla();
    bekleyenOlaylar();
    jetonuEsitle();
    tamGoster();
    yenile().then(() => { tamGoster(); odemeleriEsitle(false); tamIstegiBak(); });
  }
  setInterval(() => { if (document.visibilityState === "visible" && kimlik) { ciz(); } }, 20000);
  setInterval(() => { if (document.visibilityState === "visible" && kimlik) yenile(); }, 30000);
  baslat();

  // Tarayıcı önizlemesi için dışa açık
  window.__iyiyim = { olayIsle, ciz, set veri(v) { veri = v; }, set kimlik(k) { kimlik = k; }, goster, soruEkraniGoster };
})();
