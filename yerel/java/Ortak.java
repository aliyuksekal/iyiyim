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
    static final String KANAL_SORU = "soru_v2";
    static final String KANAL_CEVAP = "cevaplar";
    static final String KANAL_ALARM = "alarm_v1";
    static final String KANAL_DURUM = "durum";
    static final int RENK = 0xFF0E9F74;

    static SharedPreferences tercih(Context c) {
        return c.getSharedPreferences(TERCIH, Context.MODE_PRIVATE);
    }

    // ---------------- kanallar ----------------
    static void kanallariKur(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;

        // Eski sürümün sessiz/kısık kanalını kaldır (kanal ayarları sonradan değiştirilemez)
        try { nm.deleteNotificationChannel("sorular"); } catch (Exception ignored) {}

        NotificationChannel soru = new NotificationChannel(KANAL_SORU, "Gelen sorular", NotificationManager.IMPORTANCE_HIGH);
        soru.setDescription("Biri sana “İyi misin?” diye sorduğunda: sesli, ekranda açılır");
        Uri soruSesi = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        if (soruSesi == null) soruSesi = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        soru.setSound(soruSesi, new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
        soru.enableVibration(true);
        soru.setVibrationPattern(new long[]{0, 500, 250, 500, 250, 500});
        soru.enableLights(true);
        soru.setLightColor(RENK);
        soru.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

        NotificationChannel cevap = new NotificationChannel(KANAL_CEVAP, "Cevaplar", NotificationManager.IMPORTANCE_HIGH);
        cevap.setDescription("Sorduğun kişi cevap verdiğinde");

        NotificationChannel alarm = new NotificationChannel(KANAL_ALARM, "Cevap gelmedi alarmı", NotificationManager.IMPORTANCE_HIGH);
        alarm.setDescription("Sorduğun kişi zamanında cevap vermezse ya da yardım isterse");
        Uri ses = alarmSesi();
        AudioAttributes aa = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        alarm.setSound(ses, aa);
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

    static PendingIntent soruEkraniNiyeti(Context c, String soruId, String ad) {
        Intent i = new Intent(c, SoruActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        i.putExtra("soruId", soruId);
        i.putExtra("ad", ad);
        return PendingIntent.getActivity(c, noSoru(soruId), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** İzin varsa soru ekranını diğer uygulamaların ve kilit ekranının üstünde açar. */
    static boolean soruEkraniAc(Context c, String soruId, String ad) {
        if (Build.VERSION.SDK_INT >= 23 && !android.provider.Settings.canDrawOverlays(c)) return false;
        try {
            Intent i = new Intent(c, SoruActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            i.putExtra("soruId", soruId);
            i.putExtra("ad", ad);
            c.startActivity(i);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    static void soruGoster(Context c, String soruId, String ad, String altMetin) {
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, KANAL_SORU)
                .setSmallIcon(R.drawable.ic_stat_iyiyim)
                .setColor(RENK)
                .setContentTitle(ad + " soruyor: İyi misin?")
                .setContentText(altMetin != null ? altMetin : "Aşağıdan tek dokunuşla cevap ver.")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setTimeoutAfter(6L * 60 * 60 * 1000)
                .setContentIntent(soruEkraniNiyeti(c, soruId, ad))
                .addAction(0, "İyiyim", cevapNiyeti(c, soruId, "iyi", ad))
                .addAction(0, "Sonra ararım", cevapNiyeti(c, soruId, "sonra", ad))
                .addAction(0, "Yardım lazım", cevapNiyeti(c, soruId, "yardim", ad));
        if (Build.VERSION.SDK_INT < 26) {
            b.setDefaults(Notification.DEFAULT_ALL);
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
        androidx.work.Data veri = new androidx.work.Data.Builder()
                .putString("soruId", soruId).putString("cevap", cevap).putString("ad", ad).build();
        androidx.work.OneTimeWorkRequest is = new androidx.work.OneTimeWorkRequest.Builder(CevapIsci.class)
                .setConstraints(new androidx.work.Constraints.Builder()
                        .setRequiredNetworkType(androidx.work.NetworkType.CONNECTED).build())
                .setInputData(veri)
                .build();
        androidx.work.WorkManager.getInstance(c)
                .enqueueUniqueWork("cevap-" + soruId, androidx.work.ExistingWorkPolicy.REPLACE, is);
    }

    static void alarmCal(Context c, String soruId, String kisiId, String ad, long soruldu, boolean yardim) {
        String tel = telefon(c, kisiId);
        long dk = Math.max(1, (System.currentTimeMillis() - soruldu) / 60000);
        String baslik = yardim ? ad + " yardım istiyor!" : ad + " cevap vermedi";
        String metin = yardim
                ? (tel.isEmpty() ? "Hemen ulaşmaya çalış." : "Hemen ara.")
                : dk + " dakika önce sordun. " + (tel.isEmpty() ? "Ulaşmaya çalış." : "Hemen ara.");

        NotificationCompat.Builder b = new NotificationCompat.Builder(c, KANAL_ALARM)
                .setSmallIcon(R.drawable.ic_stat_iyiyim)
                .setColor(0xFFD3283F)
                .setContentTitle(baslik)
                .setContentText(metin)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setContentIntent(uygulamaAc(c, noAlarm(soruId)));
        if (Build.VERSION.SDK_INT < 26) {
            b.setSound(alarmSesi(), AudioManager.STREAM_ALARM);
            b.setVibrate(new long[]{0, 900, 500, 900, 500, 900});
        }
        if (!tel.isEmpty()) {
            Intent ara = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + tel));
            ara.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent api = PendingIntent.getActivity(c, ("ara" + soruId).hashCode(), ara,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            b.addAction(0, "Ara", api);
        }
        String wp = uluslararasi(tel);
        if (!wp.isEmpty()) {
            Intent w = new Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/" + wp));
            w.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent wpi = PendingIntent.getActivity(c, ("wp" + soruId).hashCode(), w,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            b.addAction(0, "WhatsApp", wpi);
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
