# İyiyim — Kurulum

Depo hazır, ilk derleme başarılı. Kalan adımlar yalnızca senin hesaplarınla yapılabilen işler. Hepsi telefondan, tarayıcıyla yapılabilir.

## 1. İmza şifresini GitHub'a ekle
github.com → **iyiyim** deposu → **Settings → Secrets and variables → Actions → New repository secret**
- Name: `IMZA_SIFRE`
- Secret: sana sohbette verilen şifre

Bundan sonraki her derleme imzalı APK ve Play için `.aab` üretir.
Anahtar dosyası `imza/iyiyim-yukleme.p12` olarak depoda duruyor. Şifresiz işe yaramaz. Şifreyi kaybetme.

## 2. Gizlilik sayfasını yayına al
Depo → **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main`, klasör: `/docs` → **Save**.
Birkaç dakika sonra https://aliyuksekal.github.io/iyiyim/gizlilik.html açılır.

## 3. Firebase (console.firebase.google.com)
1. **Proje ekle** → ad: `iyiyim` (Analytics kapalı olabilir).
2. **Android** simgesi → paket adı `com.matali.iyiyim` → **google-services.json** dosyasını indir.
3. Çark → **Proje ayarları → Hizmet hesapları → Yeni özel anahtar oluştur** → JSON iner. Bu dosya **gizli**, GitHub'a koyma.

## 4. Cloudflare (dash.cloudflare.com, ücretsiz)
1. **Storage & Databases → D1 → Create** → ad `iyiyim`.
2. **Workers & Pages → Create → Worker** → ad `iyiyim` → **Deploy** → **Edit code** → `sunucu/worker.js` içeriğini yapıştır → **Deploy**.
3. **Settings → Bindings → Add → D1 database** → Variable name `DB`, database `iyiyim`.
4. **Settings → Variables and Secrets → Add** → Type **Secret**, Name `FCM_HESAP`, Value: 3. adımdaki hizmet hesabı JSON'unun tamamı.
5. Worker adresini aç. `{"uygulama":"iyiyim","durum":"calisiyor"}` görmelisin.

## 5. Bana gönder
- `google-services.json` dosyasının içeriği (gizli değil, uygulamaya gömülür)
- Worker adresi (`https://iyiyim.....workers.dev`)

Bunları depoya ekleyip çalışan, imzalı sürümü derletirim.

---
Play Store adımları için: `magaza/PLAY-REHBERI.md`
