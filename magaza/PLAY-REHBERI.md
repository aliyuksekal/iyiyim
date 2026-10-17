# İyiyim · Google Play yayın rehberi

Bu klasördeki her şey Play Console'a yüklenmeye hazır. Aşağıdaki cevaplar uygulamanın gerçekte yaptığına göre yazıldı. Uygulama değişirse bunları da güncelle.

---

## 1. Mağaza girişi (Ana mağaza girişi)

**Uygulama adı** (24/30)
```
İyiyim: Sevdiklerine Sor
```

**Kısa açıklama** (75/80)
```
Tek dokunuşla “İyi misin?” diye sor. Cevap gelmezse telefonun alarm çalsın.
```

**Tam açıklama**
```
Annen yalnız mı yaşıyor? Kardeşin yolda mı? Deprem oldu ve herkesin iyi olduğundan emin olmak mı istiyorsun?

İyiyim ile sevdiklerine tek dokunuşla “İyi misin?” diye sorarsın. Onlar da bildirimin üstündeki düğmeye dokunarak, uygulamayı açmadan cevap verir. Belirlediğin sürede cevap gelmezse telefonun sesli alarm çalar ve tek dokunuşla arayabilirsin.

NASIL ÇALIŞIR
• Kişi ekle: 6 haneli kodunu paylaş, karşı taraf girsin. Telefon numarası gerekmez.
• Sor: Kişinin yanındaki “İyi mi?” düğmesine dokun.
• Cevap: Karşı tarafa bildirim gider. “İyiyim”, “Sonra ararım” ya da “Yardım lazım” düğmesine dokunması yeter.
• Alarm: Cevap gelmezse (15 dakika ile 3 saat arası, sen seçersin) telefonun alarm sesiyle uyarır. “Yardım lazım” denirse hiç beklemeden çalar.

ÖNE ÇIKANLAR
• Herkese “İyiyim” de: Kimse sormadan tüm yakınlarına tek dokunuşla iyi olduğunu bildir.
• Operatör gerekmez: SMS ya da hat kullanmaz. İnternet olan her yerde, Wi-Fi'da bile çalışır.
• İnternet yoksa bekletir: Verdiğin cevap internet gelince kendiliğinden gönderilir.
• Yaşlılar için kolay: Kocaman düğmeler, sade ekran.
• Rahatsız etmez: Aynı kişiye en fazla 30 dakikada bir sorulabilir.
• Koyu ve açık görünüm.

GİZLİLİĞİNE SAYGILI
• Telefon numaranı, e-postanı, konumunu ya da rehberini istemez.
• Reklam yok, analiz aracı yok.
• Soru ve cevaplar 30 gün sonra kendiliğinden silinir.
• Hesabını uygulamadan tek dokunuşla silebilirsin.

İyiyim bir acil durum hizmeti değildir. Hayati tehlike varsa 112'yi ara.
```

**Kategori:** Araçlar (ya da Yaşam Tarzı)
**Etiketler:** Aile, güvenlik, iletişim
**İletişim e-postası:** matali.truz@gmail.com
**Gizlilik politikası URL'si:** https://aliyuksekal.github.io/iyiyim/gizlilik.html

## 2. Görseller (bu klasörde)
| Dosya | Play'deki yeri |
|---|---|
| `simge-512.png` | Uygulama simgesi |
| `one-cikan-1024x500.png` | Öne çıkan grafik |
| `ekran-1-sor.png` … `ekran-6-acik.png` | Telefon ekran görüntüleri (1080×1920) |

---

## 3. Uygulama içeriği (Politika → Uygulama içeriği)

**Gizlilik politikası:** https://aliyuksekal.github.io/iyiyim/gizlilik.html

**Reklamlar:** Hayır, uygulamada reklam yok.

**Uygulama erişimi:** Tüm işlevler özel bir erişim gerekmeden kullanılabilir.
İnceleme ekibi için not:
```
Giriş gerekmez. Açılışta bir ad yazmak yeterli. Soru-cevap özelliğini denemek için iki cihaz gerekir: birinde Kişi ekle > Kodumu paylaş, diğerinde Kişi ekle > Kod gir.
```

**İçerik derecelendirmesi (IARC anketi):**
- Kategori: Yardımcı program / Araç
- Şiddet, cinsellik, kumar, uyuşturucu, küfür: Hayır
- Kullanıcılar birbiriyle etkileşime giriyor mu: **Evet.** Yalnızca eşleştikleri kişilerle hazır cevaplar (“İyiyim / Sonra ararım / Yardım lazım”) paylaşılıyor. Serbest metin ya da medya yok.
- Konum paylaşımı: Hayır
- Dijital satın alma: Hayır

**Hedef kitle:** 18 ve üzeri (en sade politika yolu). İstersen 13+ seçebilirsin. 13 yaş altını seçme, aile politikaları devreye girer.

**Haber uygulaması:** Hayır · **Devlet uygulaması:** Hayır · **Finans özellikleri:** Yok · **Sağlık:** Yok

**Hesap silme:** Uygulama hesap oluşturuyor (ad ile).
- Uygulama içinden silme: Ayarlar → Gelişmiş → Hesabımı sil
- Web bağlantısı: https://aliyuksekal.github.io/iyiyim/hesap-silme.html

## 4. Veri güvenliği formu

| Soru | Cevap |
|---|---|
| Veri topluyor ya da paylaşıyor mu? | **Evet, topluyor** |
| Toplanan tüm veriler aktarım sırasında şifreleniyor mu? | **Evet** (HTTPS) |
| Kullanıcılar verilerinin silinmesini isteyebilir mi? | **Evet** |
| Üçüncü taraflarla paylaşım | **Hayır** (Firebase ve Cloudflare hizmet sağlayıcıdır, paylaşım sayılmaz) |

Toplanan veri türleri, hepsi için: *Toplanıyor · Paylaşılmıyor · Geçici işlenmiyor · Zorunlu · Amaç: Uygulama işlevselliği*

| Kategori | Tür | Açıklama |
|---|---|---|
| Kişisel bilgiler | **Ad** | Kullanıcının yazdığı görünen ad |
| Mesajlar | **Diğer uygulama içi mesajlar** | “İyiyim / Sonra ararım / Yardım lazım” cevapları ve zamanları |
| Uygulama etkinliği | **Diğer kullanıcı işlemleri** | Kimlerle eşleşildiği, kime ne zaman soru sorulduğu |
| Cihaz veya diğer kimlikler | **Cihaz veya diğer kimlikler** | Firebase bildirim jetonu, rastgele hesap kimliği |

**Toplanmayanlar:** Konum, kişiler/rehber, telefon numarası, e-posta, fotoğraf, ses, finans, sağlık, tarama geçmişi.
Kişilere kaydedilen telefon numaraları **cihazdan çıkmaz**, bu yüzden “toplanan” sayılmaz.

## 5. İzinler (Play'in sorabileceği)
| İzin | Neden |
|---|---|
| POST_NOTIFICATIONS | Gelen soru ve cevapları göstermek |
| SCHEDULE_EXACT_ALARM | Cevap gelmezse alarmı tam zamanında çalmak (kullanıcı ayarlardan açar; kapalıysa yaklaşık zamanda çalar) |
| RECEIVE_BOOT_COMPLETED | Telefon yeniden başlayınca bekleyen alarmları geri kurmak |
| VIBRATE, WAKE_LOCK, INTERNET | Alarm titreşimi ve sunucuyla iletişim |

`USE_EXACT_ALARM`, `USE_FULL_SCREEN_INTENT`, ön plan hizmeti ve SMS/arama izni **kullanılmıyor**, bu yüzden ek beyan gerekmez.

## 6. Yayın sırası
1. **Kapalı test şartı:** Kişisel geliştirici hesapların çoğu için Play, üretime çıkmadan önce **en az 12 test kullanıcısıyla 14 gün kesintisiz kapalı test** istiyor. Yakınlarına İyiyim'i kurdurmak bu şartı doğal yoldan karşılar.
2. Test → Kapalı test → yeni sürüm → `Iyiyim-1.0.N-play.aab` dosyasını yükle.
3. İlk yüklemede **Play Uygulama İmzalama**yı kabul et. Bizim anahtarımız “yükleme anahtarı” olur, asıl imzayı Google saklar. Anahtar kaybolursa Play Console'dan yükleme anahtarı sıfırlanabilir.
4. 14 gün sonra **Üretime yükselt**.
