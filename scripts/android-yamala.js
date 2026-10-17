// `npx cap add android` sonrası çalışır: yerel Java kodunu, kaynakları, izinleri ve Firebase'i ekler.
const fs = require("fs");
const path = require("path");

const KOK = path.resolve(__dirname, "..");
const APP = path.join(KOK, "android", "app");
const MAIN = path.join(APP, "src", "main");
const PAKET_YOLU = path.join(MAIN, "java", "com", "matali", "iyiyim");

function kopyalaKlasor(kaynak, hedef) {
  fs.mkdirSync(hedef, { recursive: true });
  for (const ad of fs.readdirSync(kaynak)) {
    const k = path.join(kaynak, ad), h = path.join(hedef, ad);
    if (fs.statSync(k).isDirectory()) kopyalaKlasor(k, h);
    else fs.copyFileSync(k, h);
  }
}
function hepsiniBul(kok, ad, sonuc = []) {
  for (const x of fs.readdirSync(kok)) {
    const p = path.join(kok, x);
    if (fs.statSync(p).isDirectory()) hepsiniBul(p, ad, sonuc);
    else if (x === ad) sonuc.push(p);
  }
  return sonuc;
}

// 1) Java dosyaları
kopyalaKlasor(path.join(KOK, "yerel", "java"), PAKET_YOLU);
console.log("✓ Java dosyaları kopyalandı");

// 2) Kaynaklar (simgeler, açılış ekranı, bildirim simgesi)
const RES = path.join(MAIN, "res");
for (const p of hepsiniBul(RES, "splash.png")) fs.unlinkSync(p);
for (const p of hepsiniBul(RES, "ic_launcher_background.xml")) fs.unlinkSync(p);
kopyalaKlasor(path.join(KOK, "yerel", "res"), RES);
const STIL = path.join(RES, "values", "styles.xml");
if (fs.existsSync(STIL)) {
  let s = fs.readFileSync(STIL, "utf8");
  if (s.includes("Theme.SplashScreen") && !s.includes("windowSplashScreenBackground")) {
    s = s.replace(
      /(<style name="AppTheme\.NoActionBarLaunch"[^>]*>)/,
      `$1\n        <item name="windowSplashScreenBackground">@color/iyiyim_zemin</item>\n        <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground</item>`
    );
    fs.writeFileSync(STIL, s);
  }
}
console.log("✓ Simgeler ve açılış ekranı eklendi");

// 3) AndroidManifest
const MANIFEST = path.join(MAIN, "AndroidManifest.xml");
let m = fs.readFileSync(MANIFEST, "utf8");
const izinler = [
  "android.permission.INTERNET",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.SCHEDULE_EXACT_ALARM",
  "android.permission.RECEIVE_BOOT_COMPLETED",
  "android.permission.VIBRATE",
  "android.permission.WAKE_LOCK",
];
const eklenecekIzin = izinler
  .filter((i) => !m.includes(`"${i}"`))
  .map((i) => `    <uses-permission android:name="${i}" />`)
  .join("\n");
if (eklenecekIzin) m = m.replace(/<application/, eklenecekIzin + "\n\n    <application");

const bilesenler = `
        <service android:name=".MesajServisi" android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
        <receiver android:name=".CevapAlici" android:exported="false" />
        <receiver android:name=".AlarmAlici" android:exported="false" />
        <receiver android:name=".AcilisAlici" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
                <action android:name="android.intent.action.QUICKBOOT_POWERON" />
            </intent-filter>
        </receiver>
        <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_iyiyim" />
        <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="sorular" />
`;
if (!m.includes(".MesajServisi")) m = m.replace(/<\/application>/, bilesenler + "    </application>");
fs.writeFileSync(MANIFEST, m);
console.log("✓ AndroidManifest güncellendi");

// 4) build.gradle: Firebase, sürüm numarası, imza
const GRADLE = path.join(APP, "build.gradle");
let g = fs.readFileSync(GRADLE, "utf8");
const calisma = parseInt(process.env.GITHUB_RUN_NUMBER || "1", 10);
const surumAdi = (process.env.SURUM_ADI || "1.0") + "." + calisma;
g = g.replace(/versionCode\s+\d+/, `versionCode ${calisma}`);
g = g.replace(/versionName\s+"[^"]*"/, `versionName "${surumAdi}"`);
if (!g.includes("firebase-messaging")) {
  g += `
dependencies {
    implementation platform('com.google.firebase:firebase-bom:33.7.0')
    implementation 'com.google.firebase:firebase-messaging'
    implementation 'androidx.work:work-runtime:2.9.1'
}
`;
}
// Yayın imzası (yalnızca imza bilgileri ortamda varsa)
if (process.env.IMZA_DOSYASI && !g.includes("signingConfigs.release")) {
  g = g.replace(/android\s*\{/, `android {
    signingConfigs {
        release {
            storeFile file(System.getenv("IMZA_DOSYASI"))
            storePassword System.getenv("IMZA_SIFRE")
            keyAlias System.getenv("IMZA_ALIAS")
            keyPassword System.getenv("IMZA_SIFRE")
            storeType "pkcs12"
        }
    }`);
  g = g.replace(/(buildTypes\s*\{\s*release\s*\{)/, `$1\n            signingConfig signingConfigs.release`);
  console.log("✓ Yayın imzası bağlandı");
}
fs.writeFileSync(GRADLE, g);
console.log(`✓ build.gradle güncellendi (sürüm ${surumAdi}, kod ${calisma})`);

// 5) google-services.json
const GS = path.join(KOK, "google-services.json");
if (fs.existsSync(GS)) {
  fs.copyFileSync(GS, path.join(APP, "google-services.json"));
  console.log("✓ google-services.json eklendi");
} else {
  console.log("⚠ google-services.json yok: uygulama açılır ama bildirimler çalışmaz");
}
