package com.matali.iyiyim;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;

/** Bildirimler, alarmlar, ayarlar ve sunucu çağrıları için ortak yardımcılar. */
public final class Ortak {
    private Ortak() {}

    static final String TERCIH = "iyiyim";
    static final String KANAL_CEVAP = "cevaplar";
    static final String KANAL_DURUM = "durum";
    static final int RENK = 0xFF0E9F74;

    /** Seçilebilen yüksek sesli tonlar (res/raw/ton_*.ogg). */
    static final String[] TONLAR = {"zil", "can", "siren", "alarm", "melodi"};

    static SharedPreferences tercih(Context c) {
        return c.getSharedPreferences(TERCIH, Context.MODE_PRIVATE);
    }

    static String ton(Context c) {
        String t = tercih(c).getString("ton", "zil");
        for (String x : TONLAR) if (x.equals(t)) return t;
        return "zil";
    }

    /** Kanal sesi sonradan değiştirilemediği için her ton kendi kanalını kullanır. */
    static String kanalSoru(Context c) { return "soru_" + ton(c) + "_v3"; }
    static String kanalAlarm(Context c) { return "alarm_" + ton(c) + "_v2"; }

    static Uri tonUri(Context c, String ton) {
        int id = c.getResources().getIdentifier("ton_" + ton, "raw", c.getPackageName());
        if (id == 0) return alarmSesi();
        return Uri.parse("android.resource://" + c.getPackageName() + "/" + id);
    }

    static AudioAttributes yuksekSes() {
        // Alarm ses seviyesinden çalar: telefon sessizdeyken bile duyulur (çoğu telefonda)
        return new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
    }

    // ---------------- kanallar ----------------
    static void kanallariKur(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        String soruId = kanalSoru(c), alarmId = kanalAlarm(c);

        // Eski / başka tona ait kanalları kaldır
        try {
            for (NotificationChannel k : nm.getNotificationChannels()) {
                String id = k.getId();
                boolean eski = id.equals("sorular") || id.equals("soru_v2") || id.equals("alarm_v1")
                        || ((id.startsWith("soru_") || id.startsWith("alarm_")) && !id.equals(soruId) && !id.equals(alarmId));
                if (eski) nm.deleteNotificationChannel(id);
            }
        } catch (Exception ignored) {}

        Uri ses = tonUri(c, ton(c));

        NotificationChannel soru = new NotificationChannel(soruId, "Gelen sorular", NotificationManager.IMPORTANCE_HIGH);
        soru.setDescription("Biri sana “İyi misin?” diye sorduğunda: yüksek sesli, ekranda açılır");
        soru.setSound(ses, yuksekSes());
        soru.enableVibration(true);
        soru.setVibrationPattern(new long[]{0, 600, 300, 600, 300, 600});
        soru.enableLights(true);
        soru.setLightColor(RENK);
        soru.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

        NotificationChannel cevap = new NotificationChannel(KANAL_CEVAP, "Cevaplar", NotificationManager.IMPORTANCE_HIGH);
        cevap.setDescription("Sorduğun kişi cevap verdiğinde");

        NotificationChannel alarm = new NotificationChannel(alarmId, "Cevap gelmedi / Yardım alarmı", NotificationManager.IMPORTANCE_HIGH);
        alarm.setDescription("Sorduğun kişi zamanında cevap vermezse ya da yardım isterse");
        alarm.setSound(ses, yuksekSes());
        alarm.enableVibration(true);
        alarm.setVibrationPattern(new long[]{0, 900, 500, 900, 500, 900});
        alarm.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

        NotificationChannel durum = new NotificationChannel(KANAL_DURUM, "Gönderim durumu", NotificationManager.IMPORTANCE_LOW);
        durum.setDescription("Bildirimden verdiğin cevabın gönderilip gönderilmediği");

        nm.createNotificationChannels(Arrays.asList(soru, cevap, alarm, durum));
    }

    static Uri alarmSesi() {
        Uri ses = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (ses == null) ses = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        if (ses == null) ses = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        return ses;
    }

    // ---------------- bildirim numaraları ----------------
    static int noSoru(String soruId) { return ("s" + soruId).hashCode(); }
    static int noCevap(String soruId) { return ("c" + soruId).hashCode(); }
    static int noAlarm(String soruId) { return ("a" + soruId).hashCode(); }

    static PendingIntent uygulamaAc(Context c, int istekNo) {
        Intent i = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (i == null) i = new Intent(c, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c, istekNo, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void goster(Context c, int no, Notification n) {
        try {
            NotificationManagerCompat.from(c).notify(no, n);
        } catch (SecurityException e) {
            // bildirim izni yok
        }
    }

    static void kapat(Context c, int no) {
        NotificationManagerCompat.from(c).cancel(no);
    }

    // ---------------- gelen soru ----------------
    static PendingIntent cevapNiyeti(Context c, String soruId, String cevap, String ad) {
        Intent i = new Intent(c, CevapAlici.class);
        i.setAction("com.matali.iyiyim.CEVAP." + cevap);
        i.putExtra("soruId", soruId);
        i.putExtra("cevap", cevap);
        i.putExtra("ad", ad);
        return PendingIntent.getBroadcast(c, (soruId + cevap).hashCode(), i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static Intent soruEkraniIntent(Context c, String soruId, String ad, String otomatik) {
        Intent i = new Intent(c, SoruActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        i.putExtra("soruId", soruId);
        i.putExtra("ad", ad);
        if (otomatik != null) i.putExtra("otomatik", otomatik);
        return i;
    }

    static PendingIntent soruEkraniNiyeti(Context c, String soruId, String ad) {
        return PendingIntent.getActivity(c, noSoru(soruId), soruEkraniIntent(c, soruId, ad, null),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** "Yardım lazım": konum ancak ekran görünürken alınabildiği için soru ekranı üzerinden gönderilir. */
    static PendingIntent yardimNiyeti(Context c, String soruId, String ad) {
        return PendingIntent.getActivity(c, ("y" + soruId).hashCode(), soruEkraniIntent(c, soruId, ad, "yardim"),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Kilit ekranında tam ekran açılabilir mi (Android 14+ kullanıcı izni). */
    static boolean tamEkranIzni(Context c) {
        if (Build.VERSION.SDK_INT < 34) return true;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        return nm != null && nm.canUseFullScreenIntent();
    }

    static boolean ekranKilitliYaKapali(Context c) {
        android.app.KeyguardManager km = (android.app.KeyguardManager) c.getSystemService(Context.KEYGUARD_SERVICE);
        android.os.PowerManager pm = (android.os.PowerManager) c.getSystemService(Context.POWER_SERVICE);
        boolean kilitli = km != null && km.isKeyguardLocked();
        boolean kapali = pm != null && !pm.isInteractive();
        return kilitli || kapali;
    }

    /**
     * Soru gelince ekranı kaplar:
     *  - ekran kapalı/kilitliyse bildirimin tam ekran niyeti SoruActivity'yi kilit ekranının üstünde açar,
     *  - telefon kullanılıyorsa "diğer uygulamaların üstünde göster" izniyle doğrudan üst pencere açılır.
     */
    static void soruEkraniAc(Context c, String soruId, String ad) {
        if (ekranKilitliYaKapali(c)) return; // tam ekran niyeti halleder
        if (Build.VERSION.SDK_INT >= 23 && !android.provider.Settings.canDrawOverlays(c)) return;
        UstPencere.goster(c, soruId, ad);
    }

    static void soruGoster(Context c, String soruId, String ad, String altMetin) {
        kanallariKur(c);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, kanalSoru(c))
                .setSmallIcon(R.drawable.ic_stat_iyiyim)
                .setColor(RENK)
                .setContentTitle(ad + " soruyor: İyi misin?")
                .setContentText(altMetin != null ? altMetin : "Aşağıdan tek dokunuşla cevap ver.")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setTimeoutAfter(6L * 60 * 60 * 1000)
                .setContentIntent(soruEkraniNiyeti(c, soruId, ad))
                .addAction(0, "İyiyim", cevapNiyeti(c, soruId, "iyi", ad))
                .addAction(0, "Sonra ararım", cevapNiyeti(c, soruId, "sonra", ad))
                .addAction(0, "Yardım lazım", yardimNiyeti(c, soruId, ad));
        if (altMetin == null) {
            // Kilit ekranında / ekran kapalıyken soruyu tam ekran açar
            b.setFullScreenIntent(soruEkraniNiyeti(c, soruId, ad), true);
        }
        if (Build.VERSION.SDK_INT < 26) {
            b.setSound(tonUri(c, ton(c)), AudioManager.STREAM_ALARM);
            b.setVibrate(new long[]{0, 600, 300, 600, 300, 600});
        }
        Notification n = b.build();
        if (altMetin == null) n.flags |= Notification.FLAG_INSISTENT; // cevap verilene ya da dokunulana kadar ses tekrar eder
        goster(c, noSoru(soruId), n);
    }

    static void durumGoster(Context c, int no, String baslik, String metin, long zamanAsimi) {
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, KANAL_DURUM)
                .setSmallIcon(R.drawable.ic_stat_iyiyim)
                .setColor(RENK)
                .setContentTitle(baslik)
                .setContentText(metin)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOnlyAlertOnce(true)
                .setAutoCancel(true)
                .setContentIntent(uygulamaAc(c, no));
        if (zamanAsimi > 0) b.setTimeoutAfter(zamanAsimi);
        goster(c, no, b.build());
    }

    static void cevapGoster(Context c, String soruId, String ad, String cevap) {
        String baslik = "sonra".equals(cevap) ? ad + " sonra arayacak" : ad + " iyi 💚";
        String metin = "sonra".equals(cevap) ? "Cevabı: Sonra ararım" : "Cevabı: İyiyim";
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, KANAL_CEVAP)
                .setSmallIcon(R.drawable.ic_stat_iyiyim)
                .setColor(RENK)
                .setContentTitle(baslik)
                .setContentText(metin)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(uygulamaAc(c, noCevap(soruId)));
        goster(c, noCevap(soruId), b.build());
    }

    static void bilgiGoster(Context c, int no, String baslik, String metin) {
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, KANAL_CEVAP)
                .setSmallIcon(R.drawable.ic_stat_iyiyim)
                .setColor(RENK)
                .setContentTitle(baslik)
                .setContentText(metin)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)
                .setContentIntent(uygulamaAc(c, no));
        goster(c, no, b.build());
    }

    // ---------------- alarm (cevap gelmedi / yardım) ----------------
    static JSONObject bekleyenAlarmlar(Context c) {
        try {
            return new JSONObject(tercih(c).getString("alarmlar", "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    static synchronized void alarmKaydet(Context c, JSONObject liste) {
        tercih(c).edit().putString("alarmlar", liste.toString()).apply();
    }

    static synchronized void alarmKur(Context c, String soruId, String kisiId, String ad, long zaman) {
        // Aynı kişiye yeniden sorulduysa eski sorunun alarmı yerine yenisi geçer
        if (kisiId != null && !kisiId.isEmpty()) kisininAlarmlariniIptal(c, kisiId);
        try {
            JSONObject liste = bekleyenAlarmlar(c);
            JSONObject a = new JSONObject();
            a.put("soruId", soruId);
            a.put("kisiId", kisiId);
            a.put("ad", ad);
            a.put("zaman", zaman);
            a.put("soruldu", System.currentTimeMillis());
            liste.put(soruId, a);
            alarmKaydet(c, liste);
            alarmZamanla(c, soruId, zaman);
        } catch (Exception ignored) {}
    }

    static PendingIntent alarmNiyeti(Context c, String soruId) {
        Intent i = new Intent(c, AlarmAlici.class);
        i.setAction("com.matali.iyiyim.ALARM");
        i.putExtra("soruId", soruId);
        return PendingIntent.getBroadcast(c, noAlarm(soruId), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void alarmZamanla(Context c, String soruId, long zaman) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = alarmNiyeti(c, soruId);
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, zaman, pi);
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, zaman, pi);
            }
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, zaman, pi);
        }
    }

    static synchronized void alarmIptal(Context c, String soruId) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(alarmNiyeti(c, soruId));
        JSONObject liste = bekleyenAlarmlar(c);
        liste.remove(soruId);
        alarmKaydet(c, liste);
        kapat(c, noAlarm(soruId));
    }

    static synchronized JSONObject alarmAl(Context c, String soruId) {
        return bekleyenAlarmlar(c).optJSONObject(soruId);
    }

    static synchronized void alarmlariYenidenKur(Context c) {
        JSONObject liste = bekleyenAlarmlar(c);
        long simdi = System.currentTimeMillis();
        Iterator<String> it = liste.keys();
        while (it.hasNext()) {
            String id = it.next();
            JSONObject a = liste.optJSONObject(id);
            if (a == null) continue;
            long z = a.optLong("zaman", simdi);
            alarmZamanla(c, id, Math.max(z, simdi + 5000));
        }
    }

    static String telefon(Context c, String kisiId) {
        try {
            JSONObject t = new JSONObject(tercih(c).getString("telefonlar", "{}"));
            String n = t.optString(kisiId, "");
            return n == null ? "" : n.replaceAll("[^0-9+]", "");
        } catch (Exception e) {
            return "";
        }
    }

    /** 05xx... ya da 5xx... biçimindeki Türkiye numarasını 905xx... yapar (WhatsApp için). */
    static String uluslararasi(String tel) {
        if (tel == null) return "";
        String d = tel.replaceAll("[^0-9]", "");
        if (d.startsWith("00")) d = d.substring(2);
        else if (d.length() == 11 && d.startsWith("0")) d = "90" + d.substring(1);
        else if (d.length() == 10 && d.startsWith("5")) d = "90" + d;
        return d.length() >= 10 ? d : "";
    }

    /** Bu kişi için bekleyen tüm alarmları iptal eder (örn. herkese "İyiyim" dediğinde). */
    static synchronized void kisininAlarmlariniIptal(Context c, String kisiId) {
        JSONObject liste = bekleyenAlarmlar(c);
        List<String> silinecek = new ArrayList<>();
        Iterator<String> it = liste.keys();
        while (it.hasNext()) {
            String id = it.next();
            JSONObject a = liste.optJSONObject(id);
            if (a != null && kisiId.equals(a.optString("kisiId"))) silinecek.add(id);
        }
        for (String id : silinecek) alarmIptal(c, id);
    }

    /** Cevabı internet gelince gönderilmek üzere sıraya koyar. */
    static void cevapSirala(Context c, String soruId, String cevap, String ad) {
        cevapSirala(c, soruId, cevap, ad, null);
    }


    static void cevapSirala(Context c, String soruId, String cevap, String ad, JSONObject konum) {
        androidx.work.Data veri = new androidx.work.Data.Builder()
                .putString("soruId", soruId).putString("cevap", cevap).putString("ad", ad)
                .putString("konum", konum == null ? "" : konum.toString()).build();
        androidx.work.OneTimeWorkRequest is = new androidx.work.OneTimeWorkRequest.Builder(CevapIsci.class)
                .setConstraints(new androidx.work.Constraints.Builder()
                        .setRequiredNetworkType(androidx.work.NetworkType.CONNECTED).build())
                .setInputData(veri)
                .build();
        androidx.work.WorkManager.getInstance(c)
                .enqueueUniqueWork("cevap-" + soruId, androidx.work.ExistingWorkPolicy.REPLACE, is);
    }

    static void alarmCal(Context c, String soruId, String kisiId, String ad, long soruldu, boolean yardim) {
        alarmCal(c, soruId, kisiId, ad, soruldu, yardim, Double.NaN, Double.NaN, "");
    }

    static String haritaAdresi(double lat, double lng) {
        return "https://www.google.com/maps/search/?api=1&query=" + lat + "," + lng;
    }

    static void alarmCal(Context c, String soruId, String kisiId, String ad, long soruldu, boolean yardim,
                         double lat, double lng, String hassas) {
        kanallariKur(c);
        String tel = telefon(c, kisiId);
        boolean konumVar = !Double.isNaN(lat) && !Double.isNaN(lng);
        long dk = Math.max(1, (System.currentTimeMillis() - soruldu) / 60000);
        String baslik = yardim ? ad + " yardım istiyor!" : ad + " cevap vermedi";
        String metin;
        if (yardim) {
            metin = konumVar
                    ? "Konumunu gönderdi" + (hassas != null && !hassas.isEmpty() ? " (±" + hassas + " m)" : "") + ". " + (tel.isEmpty() ? "Hemen ulaş." : "Hemen ara.")
                    : (tel.isEmpty() ? "Hemen ulaşmaya çalış." : "Hemen ara.");
        } else {
            metin = dk + " dakika önce sordun. " + (tel.isEmpty() ? "Ulaşmaya çalış." : "Hemen ara.");
        }

        NotificationCompat.Builder b = new NotificationCompat.Builder(c, kanalAlarm(c))
                .setSmallIcon(R.drawable.ic_stat_iyiyim)
                .setColor(0xFFD3283F)
                .setContentTitle(baslik)
                .setContentText(metin)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(metin))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setContentIntent(uygulamaAc(c, noAlarm(soruId)))
                .setFullScreenIntent(uygulamaAc(c, noAlarm(soruId) + 1), true);
        if (Build.VERSION.SDK_INT < 26) {
            b.setSound(tonUri(c, ton(c)), AudioManager.STREAM_ALARM);
            b.setVibrate(new long[]{0, 900, 500, 900, 500, 900});
        }
        int eylem = 0;
        if (!tel.isEmpty()) {
            Intent ara = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + tel));
            ara.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            b.addAction(0, "Ara", PendingIntent.getActivity(c, ("ara" + soruId).hashCode(), ara,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            eylem++;
        }
        if (konumVar) {
            Intent k = new Intent(Intent.ACTION_VIEW, Uri.parse(haritaAdresi(lat, lng)));
            k.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            b.addAction(0, "Konumu aç", PendingIntent.getActivity(c, ("kn" + soruId).hashCode(), k,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            eylem++;
        }
        String wp = uluslararasi(tel);
        if (!wp.isEmpty() && eylem < 2) {
            Intent w = new Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/" + wp));
            w.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            b.addAction(0, "WhatsApp", PendingIntent.getActivity(c, ("wp" + soruId).hashCode(), w,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            eylem++;
        }
        Intent sus = new Intent(c, CevapAlici.class);
        sus.setAction("com.matali.iyiyim.SUSTUR");
        sus.putExtra("soruId", soruId);
        b.addAction(0, "Sustur", PendingIntent.getBroadcast(c, ("sus" + soruId).hashCode(), sus,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        Notification n = b.build();
        n.flags |= Notification.FLAG_INSISTENT; // kullanıcı dokunana kadar ses tekrar eder
        goster(c, noAlarm(soruId), n);
    }

    // ---------------- arayüze olay iletimi ----------------
    static void olay(Context c, JSONObject o) {
        if (IyiyimPlugin.olayYay(o)) return;
        synchronized (Ortak.class) {
            try {
                JSONArray dizi = new JSONArray(tercih(c).getString("olaylar", "[]"));
                dizi.put(o);
                while (dizi.length() > 30) dizi.remove(0);
                tercih(c).edit().putString("olaylar", dizi.toString()).apply();
            } catch (Exception ignored) {}
        }
    }

    static synchronized List<JSONObject> olaylariBosalt(Context c) {
        List<JSONObject> l = new ArrayList<>();
        try {
            JSONArray dizi = new JSONArray(tercih(c).getString("olaylar", "[]"));
            for (int i = 0; i < dizi.length(); i++) l.add(dizi.getJSONObject(i));
        } catch (Exception ignored) {}
        tercih(c).edit().putString("olaylar", "[]").apply();
        return l;
    }

    // ---------------- sunucu ----------------
    /** Sonuç: [durumKodu, gövde]. Ağ hatasında durum -1. Ana iş parçacığında çağırma. */
    static Object[] istek(Context c, String yontem, String yol, JSONObject govde) {
        SharedPreferences t = tercih(c);
        String sunucu = t.getString("sunucu", "");
        String id = t.getString("id", "");
        String sifre = t.getString("sifre", "");
        if (sunucu.isEmpty() || id.isEmpty()) return new Object[]{-1, ""};
        HttpURLConnection bag = null;
        try {
            URL url = new URL(sunucu.replaceAll("/+$", "") + yol);
            bag = (HttpURLConnection) url.openConnection();
            bag.setConnectTimeout(12000);
            bag.setReadTimeout(15000);
            bag.setRequestMethod(yontem);
            bag.setRequestProperty("Content-Type", "application/json");
            bag.setRequestProperty("X-Id", id);
            bag.setRequestProperty("X-Sifre", sifre);
            if (govde != null) {
                bag.setDoOutput(true);
                try (OutputStream os = bag.getOutputStream()) {
                    os.write(govde.toString().getBytes(StandardCharsets.UTF_8));
                }
            }
            int kod = bag.getResponseCode();
            InputStream is = kod >= 400 ? bag.getErrorStream() : bag.getInputStream();
            String metin = "";
            if (is != null) {
                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                byte[] tampon = new byte[4096];
                int n;
                while ((n = is.read(tampon)) > 0) bo.write(tampon, 0, n);
                is.close();
                metin = bo.toString("UTF-8");
            }
            return new Object[]{kod, metin};
        } catch (Exception e) {
            return new Object[]{-1, ""};
        } finally {
            if (bag != null) bag.disconnect();
        }
    }
}
