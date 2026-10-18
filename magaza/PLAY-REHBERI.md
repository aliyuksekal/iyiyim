# İyiyim · Google Play yayın rehberi

Bu klasördeki her şey Play Console'a yüklenmeye hazır. Aşağıdaki cevaplar uygulamanın gerçekte yaptığına göre yazıldı. Uygulama değişirse bunları da güncelle.

---

## 0. Fiyatlandırma ve ürünler

**Model:** Uygulama **ücretsiz** indirilir. Soru sormak, alarm ve "Herkese İyiyim de" **Çok İyiyim** ile açılır. Gelen sorulara cevap vermek ve "Yardım iste" herkese her zaman ücretsizdir.

- **Uygulama fiyatı:** Play Console → Para kazanma → Uygulama fiyatlandırması → **Ücretsiz**.
- **Uygulama içi ürünler:** Play Console → Para kazanma → Ürünler → **Uygulama içi ürünler** → Ürün oluştur. (Bu bölüm, ilk AAB bir test kanalına yüklendikten sonra açılır. Ödeme profili / Merchant hesabı gerekir.)

| Ürün kimliği (birebir) | Ad | Açıklama | Fiyat |
|---|---|---|---|
| `iyiyim_tam` | Çok İyiyim | Sınırsız "İyi mi?", cevap gelmezse alarm, herkese "İyiyim". Tek seferlik. | **99,99 TRY** |
| `iyiyim_hediye` | Çok İyiyim (hediye) | Bir yakınına Çok İyiyim hediye et. | **79,99 TRY** |
| `iyiyim_hediye_49` | Çok İyiyim (ek hediye) | İkinci ve sonraki hediyeler için indirimli fiyat. | **49,99 TRY** |
| `destek_149` | Geliştiriciyi destekle | İyiyim'in gelişmesine ve sunucuların açık kalmasına katkı | **149,99 TRY** |

Dördünü de **Etkin** yap. Uygulama `iyiyim_tam`'ı kalıcı ürün olarak onaylar. Hediye ürünleri ve `destek_149` tüketilir, yani tekrar tekrar alınabilir.

### Ödeme doğrulama (zorunlu, 2 dakika)
Sunucu her satın almayı Google'a sorar; sahte ödeme ve iadeler bu sayede engellenir. Bunun için Firebase hizmet hesabının Play Console'a erişimi olmalı:

1. **Google Cloud Console** → proje **iyiyim-616f2** → API'ler ve Hizmetler → Kitaplık → **Google Play Android Developer API** → **Etkinleştir**.
2. Aynı projede IAM → Hizmet hesapları → `firebase-adminsdk-…@iyiyim-616f2.iam.gserviceaccount.com` e-postasını kopyala.
3. **Play Console** → Kullanıcılar ve izinler → **Yeni kullanıcıları davet et** → bu e-postayı yapıştır.
4. Uygulama izinleri → İyiyim'i ekle → **Finansal verileri görüntüleme** ve **Siparişleri ve abonelikleri yönetme** izinlerini işaretle → Davet et.
5. İzinlerin etkinleşmesi birkaç saat sürebilir. O sürede yapılan satın almalar kaybolmaz; uygulama her açılışta yeniden dener.

Sunucu her gece Play'in iade listesine de bakar. İade edilen Tam ve hediyeler kendiliğinden kapanır.

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
• Alarm: Cevap gelmezse (15 dakika ile 4 saat arası, sen seçersin) telefonun alarm sesiyle uyarır. “Yardım lazım” denirse hiç beklemeden çalar.

ÖNE ÇIKANLAR
• Yardım lazım: Tek dokunuşla yardım iste; o anki konumun soran kişiye gider, haritada açar.
• Herkese “İyiyim” de: Kimse sormadan tüm yakınlarına tek dokunuşla iyi olduğunu bildir.
• Kilit ekranında bile açılır: Soru, telefon kilitliyken ya da başka bir uygulamadayken ekranı kaplar.
• Yüksek sesli tonlar: 5 farklı ton arasından seç, telefon sessizde olsa bile duy.
• Operatör gerekmez: SMS ya da hat kullanmaz. İnternet olan her yerde, Wi-Fi'da bile çalışır.
• İnternet yoksa bekletir: Verdiğin cevap internet gelince kendiliğinden gönderilir.
• Ana ekran düğmesi: Uygulamayı açmadan, ana ekrandan tek dokunuşla “İyiyim” de ya da yardım iste.
• Yaşlılar için kolay: Kocaman düğmeler, sade ekran.
• Yardım iste: Kimse sormadan, tek dokunuşla tüm yakınlarına yardım isteğini ve konumunu gönder.
• Bildirim geçmişi: Son 24 saatte kim sordu, kim ne cevap verdi, hepsi tek ekranda.
• 7 dil, koyu ve açık görünüm.

ÜCRETSİZ VE İYİYİM TAM
• İndirmek, gelen sorulara cevap vermek ve “Yardım iste” herkes için her zaman ücretsiz.
• Çok İyiyim (tek seferlik, abonelik yok): sınırsız “İyi mi?”, cevap gelmezse alarm, herkese “İyiyim”.
• Hediye et: Annene, babana Çok İyiyim'i sen al; o da sana sorabilsin.

GİZLİLİĞİNE SAYGILI
• Telefon numaranı, e-postanı ya da rehberini istemez. Konumun sadece “Yardım lazım” dediğinde gider.
• Reklam yok, analiz aracı yok.
• Soru ve cevaplar 30 gün sonra kendiliğinden silinir.
• Hesabını uygulamadan tek dokunuşla silebilirsin.

İyiyim bir acil durum hizmeti değildir. Hayati tehlike varsa 112'yi ara.
```

**Kategori:** Araçlar (ya da Yaşam Tarzı)
**Etiketler:** Aile, güvenlik, iletişim
**İletişim e-postası:** matali.truz@gmail.com
**Gizlilik politikası URL'si:** https://aliyuksekal.github.io/iyiyim/gizlilik.html

## 1b. Diğer diller (Mağaza girişi → Çeviri ekle)
Uygulama 7 dilde: Türkçe, İngilizce, Rusça, Özbekçe, Çince (Basitleştirilmiş), Korece, Hintçe. Play Console → Ana mağaza girişi → **Çevirileri yönet → Kendi çevirilerimi ekle** ile şu dilleri ekle ve alanları doldur:

| Dil | Uygulama adı | Kısa açıklama |
|---|---|---|
| English (en-US) | İyiyim: Are You OK? | Ask “Are you OK?” with one tap. No reply? Your phone sounds an alarm. |
| Русский (ru-RU) | İyiyim: Всё в порядке? | Спросите близких «Всё в порядке?» одним касанием. Нет ответа — тревога. |
| Oʻzbek (uz) | İyiyim: Yaxshimisiz? | Bir bosishda “Yaxshimisiz?” deb soʻrang. Javob boʻlmasa, telefon signal chaladi. |
| 中文 简体 (zh-CN) | İyiyim：你还好吗？ | 一键问候“你还好吗？”。没有回复，手机就会响铃提醒。 |
| 한국어 (ko-KR) | İyiyim: 괜찮아요? | 한 번 눌러 “괜찮아요?”라고 물어보세요. 답이 없으면 알람이 울려요. |
| हिन्दी (hi-IN) | İyiyim: क्या आप ठीक हैं? | एक टैप में पूछें “क्या आप ठीक हैं?” जवाब न आए तो फ़ोन अलार्म बजाए। |

**Tam açıklama (English)**
```
Does your mom live alone? Is your brother on the road? Want to be sure everyone is OK?

With İyiyim, you ask your loved ones “Are you OK?” with one tap. They reply right from the notification, without opening the app. If there's no reply in the time you choose, your phone sounds an alarm and you can call with one tap.

HOW IT WORKS
• Add contacts with a 6-character code. No phone number needed.
• Tap “Ask” next to a contact.
• They tap “I'm OK”, “I'll call later” or “I need help”.
• No reply in 15 minutes to 4 hours (you choose)? Your phone alarm rings. “I need help” rings right away.

HIGHLIGHTS
• Get help: one tap sends a help request and your location to everyone.
• Tell everyone “I'm OK” without being asked.
• Opens even on the lock screen.
• 5 loud tones, heard even in silent mode.
• Works on any internet connection, no SMS or carrier needed.
• Home screen widget, notification history of the last 24 hours.
• 7 languages, dark and light mode.

İyiyim is free to download. Replying and “Get help” are always free. İyiyim Plus (one-time, no subscription) unlocks asking, alarms and “Tell everyone”. You can also gift Plus to a loved one.

İyiyim is not an emergency service. In an emergency, call your local emergency number.
```

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
Giriş gerekmez. Açılışta bir ad yazmak yeterli. Soru sormak Çok İyiyim (uygulama içi satın alma) ister; cevap vermek ve "Yardım iste" ücretsizdir. Soru-cevap özelliğini denemek için iki cihaz gerekir: birinde Kişi ekle > Kodumu paylaş, diğerinde Kişi ekle > Kod gir.
```

**İçerik derecelendirmesi (IARC anketi):**
- Kategori: Yardımcı program / Araç
- Şiddet, cinsellik, kumar, uyuşturucu, küfür: Hayır
- Kullanıcılar birbiriyle etkileşime giriyor mu: **Evet.** Yalnızca eşleştikleri kişilerle hazır cevaplar (“İyiyim / Sonra ararım / Yardım lazım”) paylaşılıyor. Serbest metin ya da medya yok.
- Konum paylaşımı: **Evet**, yalnızca kullanıcı “Yardım lazım” dediğinde ve sadece eşleştiği kişiyle
- Dijital satın alma: **Evet** (Çok İyiyim, hediye ve isteğe bağlı “Geliştiriciyi destekle”)

**Hedef kitle:** 18 ve üzeri (en sade politika yolu). İstersen 13+ seçebilirsin. 13 yaş altını seçme, aile politikaları devreye girer.

**Haber uygulaması:** Hayır · **Devlet uygulaması:** Hayır · **Finans özellikleri:** Yok · **Sağlık:** Yok

**Hesap silme:** Uygulama hesap oluşturuyor (ad ile).
- Uygulama içinden silme: Ayarlar → Hesabımı sil
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
| Konum | **Yaklaşık konum** ve **Hassas konum** | Yalnızca “Yardım lazım” anında tek seferlik; soruyu soran kişiye iletilir. İsteğe bağlı (izin verilmezse yardım isteği konumsuz gider) |
| Finansal bilgiler | **Satın alma geçmişi** | Ödeme Google Play'de yapılır. Sunucu yalnızca satın alma jetonunu, sipariş numarasını ve ödendi/iade durumunu saklar (Çok İyiyim'i doğrulamak için) |

**Toplanmayanlar:** Arka plan konumu, kişiler/rehber, telefon numarası, e-posta, fotoğraf, ses, finans, sağlık, tarama geçmişi.
Kişilere kaydedilen telefon numaraları **cihazdan çıkmaz**, bu yüzden “toplanan” sayılmaz.

## 5. İzinler (Play'in sorabileceği)
| İzin | Neden |
|---|---|
| POST_NOTIFICATIONS | Gelen soru ve cevapları göstermek |
| SCHEDULE_EXACT_ALARM | Cevap gelmezse alarmı tam zamanında çalmak (kullanıcı ayarlardan açar; kapalıysa yaklaşık zamanda çalar) |
| RECEIVE_BOOT_COMPLETED | Telefon yeniden başlayınca bekleyen alarmları geri kurmak |
| VIBRATE, WAKE_LOCK, INTERNET | Alarm titreşimi ve sunucuyla iletişim |
| SYSTEM_ALERT_WINDOW | Gelen soruyu o an açık olan uygulamanın üstünde göstermek (kullanıcı ayarlardan açar) |
| USE_FULL_SCREEN_INTENT | Telefon kilitliyken soru/alarm ekranını açmak. **Play Console'da beyan ister:** Uygulama içeriği → Tam ekran amaçlı bildirim → "Alarm" ya da "diğer" seçip şu açıklamayı yaz: *Yakınının "İyi misin?" sorusu ve cevap gelmediğinde çalan güvenlik alarmı, kilit ekranında tam ekran gösterilir.* Google onaylamazsa izin varsayılan kapalı gelir; kullanıcı Ayarlar'daki "Kilit ekranında açılsın" satırından açabilir. |
| ACCESS_FINE / COARSE_LOCATION | Yalnızca "Yardım lazım" anında, ekran açıkken tek seferlik konum. **Arka plan konumu (ACCESS_BACKGROUND_LOCATION) yok**, ek beyan gerekmez. |
| BILLING | Google Play üzerinden Çok İyiyim, hediye ve destek ödemesi |

`USE_EXACT_ALARM`, ön plan hizmeti, arka plan konumu ve SMS/arama izni **kullanılmıyor**.

## 6. Yayın sırası
1. **Kapalı test şartı:** Kişisel geliştirici hesapların çoğu için Play, üretime çıkmadan önce **en az 12 test kullanıcısıyla 14 gün kesintisiz kapalı test** istiyor. Yakınlarına İyiyim'i kurdurmak bu şartı doğal yoldan karşılar.
2. Test → Kapalı test → yeni sürüm → `Iyiyim-1.0.N-play.aab` dosyasını yükle.
3. İlk yüklemede **Play Uygulama İmzalama**yı kabul et. Bizim anahtarımız “yükleme anahtarı” olur, asıl imzayı Google saklar. Anahtar kaybolursa Play Console'dan yükleme anahtarı sıfırlanabilir.
4. 14 gün sonra **Üretime yükselt**.
