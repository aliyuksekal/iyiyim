# İyiyim — Kurulum

Üç parça var: **Firebase** (bildirimleri telefona taşır), **Cloudflare** (küçük sunucu) ve **GitHub** (APK'yı derler). Hepsi ücretsiz, hepsi telefondan tarayıcıyla yapılabilir.

---

## 1. GitHub
1. `iyiyim` adında yeni bir depo aç.
2. Bu klasördeki her şeyi deponun köküne yükle (`.github` klasörü dahil).

## 2. Firebase (console.firebase.google.com)
1. **Proje ekle** → ad: `iyiyim` → Google Analytics'i kapatabilirsin.
2. Proje ana sayfasında **Android** simgesine dokun:
   - Paket adı: `com.matali.iyiyim`
   - **google-services.json** dosyasını indir → GitHub deposunun **köküne** yükle.
3. Sol üstteki çark → **Proje ayarları** → **Hizmet hesapları** → **Yeni özel anahtar oluştur**.
   - İnen JSON dosyası **gizlidir**. GitHub'a koyma. Sadece 3. adımda Cloudflare'e yapıştıracaksın.

## 3. Cloudflare (dash.cloudflare.com, ücretsiz hesap)
1. **Storage & Databases → D1 → Create** → ad: `iyiyim`.
2. **Workers & Pages → Create → Worker** → ad: `iyiyim` → **Deploy**.
3. **Edit code** → içindekini sil → `sunucu/worker.js` dosyasının tamamını yapıştır → **Deploy**.
4. Worker sayfasında **Settings → Bindings → Add → D1 database**
   - Variable name: `DB`
   - Database: `iyiyim`
5. **Settings → Variables and Secrets → Add**
   - Type: **Secret**
   - Name: `FCM_HESAP`
   - Value: Firebase'den indirdiğin hizmet hesabı JSON'unun **tamamı**
6. Worker adresini tarayıcıda aç (`https://iyiyim.KULLANICI-ADIN.workers.dev`).
   `{"uygulama":"iyiyim","durum":"calisiyor"}` görüyorsan sunucu hazır. Tablolar kendiliğinden kurulur.

## 4. Adresi uygulamaya yaz
`www/config.js` içindeki adresi kendi Worker adresinle değiştir ve kaydet.
GitHub Actions otomatik derler. APK **Releases** kısmında `İyiyim test N` adıyla çıkar.

> Adresi sonradan değiştirmek istersen uygulamada **Ayarlar → Gelişmiş → Sunucu adresi** var, yeniden derlemen gerekmez.

## 5. Dene
1. İki telefona kur (seninki + bir yakının).
2. Biri **Kişi ekle → Kodumu paylaş**, diğeri **Kod gir**.
3. **İyi mi?** düğmesine bas. Karşı telefonda bildirim gelir, üstündeki **İyiyim** düğmesiyle cevap verilir.
4. Alarmı denemek için Ayarlar'dan süreyi **15 dk** yap ve cevap verme.

---

### Bilinmesi gerekenler
- Aynı kişiye **30 dakikada bir** soru sorulabilir.
- Test APK'ları sabit bir test imzasıyla derlenir, yeni sürüm eskisinin üstüne kurulur.
- Play Store'a göndermeden önce gerçek imzayla `.aab` derlemesi eklenecek.
- Xiaomi, Oppo, Huawei gibi telefonlarda **Pil kısıtlamasını kaldır** adımı önemli, yoksa bildirimler gecikebilir.
