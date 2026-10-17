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
      konumIzni: async () => ({ durum: "granted" }),
      konumAl: async () => ({ lat: 41.0082, lng: 28.9784, hassas: 15, zaman: Date.now() }),
      tonSec: async (o) => ({ ton: o.ton }),
      tonDinle: async () => ({}),
      tonDurdur: async () => ({}),
      destekFiyati: async () => ({ durum: "hata", fiyat: "", mesaj: "" }),
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
    if (!sunucu() || sunucu().includes("KULLANICI")) throw new Error("Sunucu adresi ayarlanmamış");
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
      const h = new Error("İnternete bağlanılamadı");
      h.ag = true;
      throw h;
    }
    const v = await r.json().catch(() => ({}));
    if (!r.ok) {
      const h = new Error(v.hata || "Bir şeyler ters gitti");
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
      DurumCubugu.setBackgroundColor({ color: koyu ? "#0B0F14" : "#F3F6F4" }).catch(() => {});
    }
  }
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", temaUygula);

  // ---------- zaman metinleri ----------
  function once(ms) {
    const dk = Math.floor(ms / 60000);
    if (dk < 1) return "az önce";
    if (dk < 60) return dk + " dk önce";
    const sa = Math.floor(dk / 60);
    if (sa < 24) return sa + " sa önce";
    const gun = Math.floor(sa / 24);
    return gun === 1 ? "dün" : gun + " gün önce";
  }
  function kalanMetin(ms) {
    const dk = Math.ceil(ms / 60000);
    if (dk < 60) return dk + " dk";
    const sa = Math.floor(dk / 60), d = dk % 60;
    return d ? `${sa} sa ${d} dk` : `${sa} sa`;
  }

  // ---------- kişi durumu ----------
  function durumHesapla(k) {
    const s = k.sonSoru;
    const d = k.sonDurum;
    // Kişi kimse sormadan herkese durum bildirdiyse ve bu, son cevaptan yeniyse onu göster
    if (d && (!s || (s.cevap && d.zaman > (s.cevap_zamani || 0)) || (!s.cevap && d.zaman > s.zaman))) {
      const t0 = simdi();
      const soruArasi0 = (veri && veri.soruArasi) || 30 * 60 * 1000;
      const kilit0 = s ? Math.max(0, soruArasi0 - (t0 - s.zaman)) : 0;
      if (d.cevap === "yardim") return { sinif: "durum-yardim", metin: "Yardım istedi · " + once(t0 - d.zaman), kilit: kilit0 };
      if (d.cevap === "sonra") return { sinif: "durum-sonra", metin: "Müsait değil · " + once(t0 - d.zaman), kilit: kilit0 };
      return { sinif: "durum-iyi", metin: "Kendisi bildirdi: İyi · " + once(t0 - d.zaman), kilit: kilit0 };
    }
    const t = simdi();
    const soruArasi = (veri && veri.soruArasi) || 30 * 60 * 1000;
    const kilit = s ? Math.max(0, soruArasi - (t - s.zaman)) : 0;
    if (!s) return { sinif: "", metin: "Henüz sormadın", kilit };
    if (s.cevap === "yardim") return { sinif: "durum-yardim", metin: "Yardım istedi · " + once(t - s.cevap_zamani), kilit };
    if (s.cevap === "iyi") return { sinif: "durum-iyi", metin: "İyi · " + once(t - s.cevap_zamani), kilit };
    if (s.cevap === "sonra") return { sinif: "durum-sonra", metin: "Sonra arayacak · " + once(t - s.cevap_zamani), kilit };
    const sureMs = ayar.sureDk * 60000;
    const gecen = t - s.zaman;
    if (gecen < sureMs) return { sinif: "durum-bekliyor", metin: `Bekleniyor · alarma ${kalanMetin(sureMs - gecen)}`, kilit };
    return { sinif: "durum-cevapsiz", metin: "Cevap vermedi · " + once(gecen) + " soruldu", kilit };
  }

  const ARA_SVG = '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>';

  function ciz() {
    if (!kimlik) return;
    $("#selam").textContent = `Merhaba ${kimlik.ad}.`;
    const liste = (veri && veri.kisiler) || [];
    $("#herkese").hidden = liste.length === 0;

    // gelen sorular
    const gelen = liste.filter((k) => k.bekleyenSoru);
    $("#gelen-sorular").innerHTML = gelen.map((k) => `
      <div class="gelen" data-soru="${kacis(k.bekleyenSoru.id)}">
        <p>${kacis(k.ad)} soruyor: İyi misin?<small>${once(simdi() - k.bekleyenSoru.zaman)}</small></p>
        <div class="uclu">
          <button class="dugme dugme-ana" data-cevap="iyi">İyiyim</button>
          <button class="dugme dugme-ikincil" data-cevap="sonra">Sonra</button>
          <button class="dugme cevap-yardim" data-cevap="yardim">Yardım</button>
        </div>
      </div>`).join("");

    $("#bos").hidden = liste.length > 0;
    $("#kisi-liste").innerHTML = liste.map((k) => {
      const d = durumHesapla(k);
      const tel = telefonlar[k.id];
      let sag;
      if ((d.sinif === "durum-yardim" || d.sinif === "durum-cevapsiz") && tel) {
        sag = `<a class="sor-dugme ara" href="tel:${kacis(tel.replace(/[^0-9+]/g, ""))}">${ARA_SVG}Ara</a>`;
      } else if (d.kilit > 0) {
        sag = `<button class="sor-dugme bekliyor" disabled aria-label="${kalanMetin(d.kilit)} sonra tekrar sorabilirsin">${kalanMetin(d.kilit)}</button>`;
      } else {
        sag = `<button class="sor-dugme" data-sor="${kacis(k.id)}">İyi mi?</button>`;
      }
      return `
        <div class="kisi ${d.sinif}">
          <div class="avatar" aria-hidden="true">${kacis((k.ad || "?").trim().charAt(0).toLocaleUpperCase("tr"))}</div>
          <div class="kisi-orta">
            <button class="kisi-bilgi" data-kisi="${kacis(k.id)}">
              <span class="kisi-ad">${kacis(k.ad)}</span>
              <span class="kisi-durum">${kacis(d.metin)}</span>
            </button>
            ${d.sinif === "durum-yardim" && k.sonSoru && k.sonSoru.konum ? `<a class="konum-link" href="https://www.google.com/maps/search/?api=1&query=${k.sonSoru.konum.lat},${k.sonSoru.konum.lng}">📍 Konumu gör</a>` : ""}
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
      // Bildirim kaçmış olsa bile, uygulama açıkken bekleyen soruyu tam ekran göster
      const bekleyen = (v.kisiler || []).filter((k) => k.bekleyenSoru && !gosterilenSorular.has(k.bekleyenSoru.id))
        .sort((p, q) => q.bekleyenSoru.zaman - p.bekleyenSoru.zaman)[0];
      if (bekleyen && document.visibilityState === "visible" && $("#soru-ekran").hidden) {
        soruEkraniGoster(bekleyen.bekleyenSoru.id, bekleyen.ad);
      }
    } catch (e) {
      if (e.durum === 401) { hesabiSifirla(); return; }
      const u = $("#baglanti-uyari");
      u.textContent = e.ag ? "İnternet yok gibi. Bağlanınca liste güncellenecek." : e.message;
      u.hidden = false;
      if (!sessiz) tost(e.message);
      ciz();
    } finally {
      yenileniyor = false;
    }
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
    dugme.disabled = true;
    dugme.textContent = "…";
    try {
      const v = await istek("/sor", { kime: kisiId });
      const alarmZamani = Date.now() + ayar.sureDk * 60000;
      await Iyiyim.alarmKur({ soruId: v.soruId, kisiId, ad: k.ad, telefon: telefonlar[kisiId] || "", zaman: alarmZamani }).catch(() => {});
      kurulanAlarmlar[v.soruId] = true;
      yaz("alarmlar", kurulanAlarmlar);
      k.sonSoru = { id: v.soruId, zaman: v.zaman, cevap: null, cevap_zamani: null };
      ciz();
      tost(v.ulasti ? `Soru gönderildi: ${k.ad}` : `Soru kaydedildi. ${k.ad} uygulamayı açınca görecek.`, 3200);
      if ("vibrate" in navigator) navigator.vibrate(20);
    } catch (e) {
      if (e.durum === 429 && e.veri && e.veri.kalan) tost(`${kalanMetin(e.veri.kalan)} sonra tekrar sorabilirsin`);
      else tost(e.message);
      yenile();
    }
  }

  // ---------- cevaplama ----------
  async function cevapla(soruId, cevap) {
    const gelen = ((veri && veri.kisiler) || []).find((k) => k.bekleyenSoru && k.bekleyenSoru.id === soruId);
    let konum = null;
    if (cevap === "yardim") {
      tost("Konumun alınıyor…", 10000);
      const k = await Iyiyim.konumAl().catch(() => ({}));
      if (k && isFinite(k.lat) && isFinite(k.lng)) konum = k;
    }
    try {
      await istek("/cevap", konum ? { soruId, cevap, konum } : { soruId, cevap });
      Iyiyim.soruBildirimiKapat({ soruId }).catch(() => {});
      tost(cevap === "iyi" ? "“İyiyim” gönderildi" : cevap === "sonra" ? "“Sonra ararım” gönderildi" : konum ? "Yardım isteğin ve konumun gönderildi" : "Yardım isteğin gönderildi");
      $("#soru-ekran").hidden = true;
      yenile();
    } catch (e) {
      if (e.ag && yerel) {
        await Iyiyim.cevapSirala({ soruId, cevap, ad: gelen ? gelen.ad : "", konum: konum || undefined }).catch(() => {});
        $("#soru-ekran").hidden = true;
        tost("İnternet yok. Cevabın bağlantı gelince otomatik gönderilecek.", 4000);
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
    $("#soru-kimden").innerHTML = `<b>${kacis(ad)}</b> soruyor`;
    $("#soru-not").textContent = `Cevabın ${ad} kişisine hemen iletilir.`;
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
        const m = { iyi: "iyi 💚", sonra: "sonra arayacak", yardim: "YARDIM İSTİYOR" }[o.cevap] || "cevap verdi";
        tost(`${o.ad} ${m}`, 4000);
      }
    } else if (o.tip === "durum") {
      if (document.visibilityState === "visible") {
        const m = { iyi: "iyi olduğunu bildirdi 💚", sonra: "müsait olmadığını bildirdi", yardim: "YARDIM İSTİYOR" }[o.cevap] || "durum bildirdi";
        tost(`${o.ad} ${m}`, 4000);
      }
    } else if (o.tip === "eklendi") {
      tost(`${o.ad} seni ekledi`);
      sayfaKapat();
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
      if (!davet || !davet.kod) throw new Error("Kod alınamadı, tekrar dene");
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

  const davetMetni = () => `İyiyim'de birbirimizi ekleyelim. Uygulamayı açıp “Kişi ekle > Kod gir” kısmına bu kodu yaz: ${davet.kod}`;
  $("#kod-paylas").addEventListener("click", async () => {
    if (!davet) return;
    try {
      if (PaylasP) await PaylasP.share({ title: "İyiyim", text: davetMetni(), dialogTitle: "Kodu gönder" });
      else if (navigator.share) await navigator.share({ text: davetMetni() });
      else throw 0;
    } catch (e) { kopyala(davetMetni()); }
  });
  $("#kod-kopyala").addEventListener("click", () => davet && kopyala(davet.kod));
  async function kopyala(metin) {
    try { await navigator.clipboard.writeText(metin); tost("Kopyalandı"); }
    catch (e) { tost("Kopyalanamadı, kodu basılı tutup seç"); }
  }

  $("#kod-girdi").addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 6);
  });
  $("#kod-ekle").addEventListener("click", async () => {
    const kod = $("#kod-girdi").value;
    if (kod.length !== 6) { tost("Kod 6 karakter olmalı"); return; }
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
    sayfaAc("#sayfa-kisi");
  }
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
    if (!cikarOnay) { cikarOnay = true; b.textContent = "Emin misin? Tekrar dokun"; setTimeout(() => { cikarOnay = false; b.textContent = "Listeden çıkar"; }, 3500); return; }
    cikarOnay = false;
    b.textContent = "Listeden çıkar";
    try {
      await istek("/kisi-sil", { id: seciliKisi.id });
      delete telefonlar[seciliKisi.id];
      yaz("telefonlar", telefonlar);
      sayfaKapat();
      tost(`${seciliKisi.ad} çıkarıldı`);
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
    if (!herkeseOnay) {
      herkeseOnay = true;
      b.classList.add("onay");
      b.lastChild.textContent = " Gönderilsin mi? Tekrar dokun";
      setTimeout(() => { herkeseOnay = false; b.classList.remove("onay"); b.lastChild.textContent = " Herkese “İyiyim” de"; }, 3500);
      return;
    }
    herkeseOnay = false;
    b.classList.remove("onay");
    b.lastChild.textContent = " Herkese “İyiyim” de";
    b.disabled = true;
    try {
      const v = await istek("/herkese", { cevap: "iyi" });
      tost(`${v.kisi} kişiye “İyiyim” gönderildi`);
      if ("vibrate" in navigator) navigator.vibrate(20);
      yenile();
    } catch (e) {
      if (e.durum === 429 && e.veri && e.veri.kalan) tost(`Az önce bildirdin. ${kalanMetin(e.veri.kalan)} sonra tekrar gönderebilirsin`);
      else tost(e.message);
    } finally { b.disabled = false; }
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
    const ad = [d.marka, d.model].filter(Boolean).join(" ") || "Telefonun";
    const adimlar = MARKA_ADIMLARI[grup];
    const kutu = $(hedef);
    kutu.innerHTML = `<h3>${kacis(ad)}<small>Bu telefonlarda bildirimlerin arka planda gelmesi için şunları aç:</small></h3>` +
      adimlar.map((s, i) => `<div class="marka-adim"><span class="no">${i + 1}</span><div><b>${s[0]}</b><br>${s[1]}${s[2] ? `<br><button class="dugme dugme-ikincil" data-marka-izin="${s[2]}">Ayarı aç</button>` : ""}</div></div>`).join("");
    const alt = $("#marka-alt");
    if (alt) alt.textContent = ad;
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-marka-izin]");
    if (!b) return;
    const t = b.dataset.markaIzin;
    if (t === "otomatik") { const r = await Iyiyim.otomatikBaslatma().catch(() => ({})); if (!r.ozel) tost("Uygulama ayarları açıldı. “Otomatik başlatma”yı orada ara."); }
    else izinIste(t, null);
  });
  $("#marka-ac").addEventListener("click", () => { markaRehberi("#ayar-marka"); sayfaAc("#sayfa-marka"); });

  // --- bildirim denemesi ---
  function kontrolSatiri(durum, baslik, metin) {
    const isaret = { ok: "✓", hata: "✕", bekle: "…" }[durum];
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
      satirlar.push(iz.bildirim ? kontrolSatiri("ok", "Bildirim izni açık") : kontrolSatiri("hata", "Bildirim izni kapalı", "Ayarlar → Bildirim izni"));
      yaz2();
      // 2) telefon jetonu
      const j = await Iyiyim.jetonAl().catch((e) => ({ token: "", hata: e.message }));
      if (!j.token) {
        satirlar.push(kontrolSatiri("hata", "Telefon bildirim kimliği alamadı", j.hata || "Google Play Hizmetleri güncel mi, internet var mı?"));
        yaz2();
        return;
      }
      satirlar.push(kontrolSatiri("ok", "Telefonun bildirim kimliği hazır"));
      yaz2();
      // 3) sunucuya kaydet
      await istek("/guncelle", { token: j.token });
      kimlik.token = j.token; yaz("kimlik", kimlik);
      satirlar.push(kontrolSatiri("ok", "Sunucuya kaydedildi"));
      yaz2();
      // 4) sunucudan gönder
      const r = await istek("/deneme", { gecikme: gecikme || 0 });
      if (r.proje && window.IYIYIM_FIREBASE && r.proje !== window.IYIYIM_FIREBASE) {
        satirlar.push(kontrolSatiri("hata", "Sunucu başka bir Firebase projesine bağlı", `Sunucu: ${r.proje}, uygulama: ${window.IYIYIM_FIREBASE}`));
      } else if (r.ok) {
        satirlar.push(kontrolSatiri("ok", gecikme ? "Gönderim planlandı" : "Sunucu bildirimi gönderdi", gecikme ? "Şimdi uygulamadan çık. 15 saniye içinde “Bildirimler çalışıyor ✓” gelmeli." : "Birkaç saniye içinde “Bildirimler çalışıyor ✓” bildirimi gelmeli."));
        satirlar.push(kontrolSatiri("bekle", "Gelmezse", "Sorun telefonda: yukarıdaki “Telefonuna özel ayarlar”ı yap."));
      } else {
        satirlar.push(kontrolSatiri("hata", "Sunucu bildirimi gönderemedi", r.gonderim));
      }
      yaz2();
    } catch (e) {
      satirlar.push(kontrolSatiri("hata", "Sunucuya ulaşılamadı", e.durum === 404 ? "Sunucu kodu eski: Cloudflare'deki worker.js güncellenmeli" : e.message));
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
  $("#alt-surum").textContent = "Sürüm " + (window.IYIYIM_SURUM || "");
  $("#destek-ac").addEventListener("click", async () => {
    sayfaAc("#sayfa-destek");
    const r = await Iyiyim.destekFiyati().catch(() => ({}));
    if (r && r.fiyat) $("#destek-fiyat").textContent = r.fiyat;
  });
  $("#destek-ol").addEventListener("click", async () => {
    const b = $("#destek-ol");
    b.disabled = true;
    try {
      const r = await Iyiyim.destekOl();
      if (r.durum === "tesekkurler") {
        $("#destek-baslik").textContent = "Teşekkür ederim 💚";
        $("#destek-metin").innerHTML = "<p>Desteğin ulaştı. Bugün birinin “İyiyim” diyebilmesine sen de katkı verdin.</p><p>Bu uygulamayı her geliştirdiğimde aklımda olacaksın.</p>";
        b.hidden = true;
        $("#destek-not").textContent = "— matali";
      } else if (r.durum === "iptal") {
        tost("Sorun değil, İyiyim seninle 💚");
      } else if (r.mesaj) {
        tost(r.mesaj, 4000);
      }
    } catch (e) { tost("Ödeme başlatılamadı"); }
    finally { b.disabled = false; }
  });

  // --- ayarlar ---
  function ayarlariDoldur() {
    $("#ayar-ad").value = kimlik ? kimlik.ad : "";
    secimleriGoster();
    $("#surum").textContent = window.IYIYIM_SURUM || "";
    izinleriGoster();
    cihazAl().then((d) => { const alt = $("#marka-alt"); if (alt) alt.textContent = [d.marka, d.model].filter(Boolean).join(" ") || "Markana göre gereken ayarlar"; });
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
      db.textContent = d.bildirim ? "Açık" : "Kapalı";
      db.className = d.bildirim ? "tamam" : "eksik";
      da.textContent = d.tamAlarm ? "Açık" : "Kapalı";
      da.className = d.tamAlarm ? "tamam" : "eksik";
      const dt = $("#durum-tamekran");
      dt.textContent = d.tamEkran ? "Açık" : "Kapalı";
      dt.className = d.tamEkran ? "tamam" : "eksik";
      $("#ayar-tamekran-satir").hidden = d.sdk < 34;
      $("#izin-tamekran-satir").hidden = d.sdk < 34;
      const dk = $("#durum-konum");
      dk.textContent = d.konum ? "Açık" : "Kapalı";
      dk.className = d.konum ? "tamam" : "eksik";
      const du = $("#durum-ustte");
      du.textContent = d.ustte ? "Açık" : "Kapalı";
      du.className = d.ustte ? "tamam" : "eksik";
      $("#ayar-alarm-satir").hidden = d.sdk < 31;
      $("#izin-alarm-satir").hidden = d.sdk < 31;
    } catch (e) {}
  }
  $("#ayarlar-ac").addEventListener("click", () => { ayarlariDoldur(); sayfaAc("#sayfa-ayar"); });
  $("#ayar-kaydet").addEventListener("click", async () => {
    const b = $("#ayar-kaydet");
    const ad = $("#ayar-ad").value.trim();
    if (!ad) { tost("Ad boş olamaz"); $("#ayar-ad").focus(); return; }
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
    if (!silOnay) { silOnay = true; b.textContent = "Tüm kişilerin silinecek. Emin misin?"; setTimeout(() => { silOnay = false; b.textContent = "Hesabımı sil"; }, 4000); return; }
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
        if (r.durum === "granted" && dugme) { dugme.textContent = "Tamam ✓"; dugme.classList.add("tamam"); }
        if (r.durum !== "granted") tost("İzin verilmedi. Telefon ayarlarından açabilirsin.");
      } else if (tur === "pil") {
        await Iyiyim.pilAyari();
      } else if (tur === "alarm") {
        await Iyiyim.alarmAyari();
      } else if (tur === "tamekran") {
        await Iyiyim.tamEkranAyari();
      } else if (tur === "konum") {
        const r = await Iyiyim.konumIzni();
        if (r.durum === "granted" && dugme) { dugme.textContent = "Tamam ✓"; dugme.classList.add("tamam"); }
        if (r.durum !== "granted") tost("Konum izni verilmedi. Yardım isteği konumsuz gider.");
      } else if (tur === "ustte") {
        await Iyiyim.usteAyari();
      } else if (tur === "sesli") {
        await Iyiyim.bildirimAyari();
      } else if (tur === "uygulama") {
        await Iyiyim.uygulamaAyarlariAc();
      }
    } catch (e) { tost("Ayar açılamadı"); }
    setTimeout(izinleriGoster, 600);
  }
  $$("[data-izin]").forEach((b) => b.addEventListener("click", () => izinIste(b.dataset.izin, b)));

  // ---------- liste tıklamaları ----------
  $("#kisi-liste").addEventListener("click", (e) => {
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
    if (!ad) { tost("Önce adını yaz"); $("#ad-girdi").focus(); return; }
    const b = $("#ad-devam");
    b.disabled = true; b.textContent = "Hazırlanıyor…";
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
      if (!$("#soru-ekran").hidden) { tost("Önce bir cevap seç"); return; }
      if (acikSayfa) { sayfaKapat(); return; }
      UygulamaP.minimizeApp ? UygulamaP.minimizeApp() : UygulamaP.exitApp();
    });
    UygulamaP.addListener("resume", () => { bekleyenOlaylar(); yenile(); });
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { bekleyenOlaylar(); yenile(); } });

  // ---------- başlat ----------
  async function baslat() {
    temaUygula();
    Iyiyim.addListener("olay", olayIsle);
    if (!kimlik) { goster("karsilama"); return; }
    goster("ana");
    ciz();
    await yerelAyarla();
    bekleyenOlaylar();
    jetonuEsitle();
    yenile();
  }
  setInterval(() => { if (document.visibilityState === "visible" && kimlik) { ciz(); } }, 20000);
  setInterval(() => { if (document.visibilityState === "visible" && kimlik) yenile(); }, 30000);
  baslat();

  // Tarayıcı önizlemesi için dışa açık
  window.__iyiyim = { olayIsle, ciz, set veri(v) { veri = v; }, set kimlik(k) { kimlik = k; }, goster, soruEkraniGoster };
})();
