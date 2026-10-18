package com.matali.iyiyim;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.SizeF;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Ana ekran düğmesi: uygulamayı açmadan herkese "İyiyim" de ya da konumla yardım iste.
 * Yaşlılar için iki büyük düğme; "Yardım iste" yanlışlıkla basılmasın diye iki dokunuş ister.
 *
 * Boyuta göre üç düzen: küçük (yalnız iki düğme), orta (+ tek satır haber), büyük (+ kayan haberler).
 * Düğme yayınları dışa kapalı {@link WidgetAlici}'ya gider; başka uygulamalar tetikleyemez.
 */
public class IyiyimWidget extends AppWidgetProvider {

    static final String IYI = "com.matali.iyiyim.WIDGET_IYI";
    static final String YARDIM = "com.matali.iyiyim.WIDGET_YARDIM";
    static final String SIFIRLA = "com.matali.iyiyim.WIDGET_SIFIRLA";
    private static final long ONAY_SURESI = 5000;
    /** Kayan satırda en fazla bu kadar eski haber gösterilir. */
    private static final long HABER_OMRU = 4L * 60 * 60 * 1000;

    private static final int KUCUK = 0, ORTA = 1, BUYUK = 2;

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] idler) {
        ciz(c);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle yeni) {
        ciz(c);
    }

    @Override
    public void onEnabled(Context c) {
        // "5 dk önce" yazıları eskimesin ve 4 saati geçen haberler düşsün diye 15 dakikada bir tazelenir
        android.app.AlarmManager am = (android.app.AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.setInexactRepeating(android.app.AlarmManager.RTC, System.currentTimeMillis() + 900000L,
                android.app.AlarmManager.INTERVAL_FIFTEEN_MINUTES, yayin(c, SIFIRLA, 7005));
    }

    @Override
    public void onDisabled(Context c) {
        android.app.AlarmManager am = (android.app.AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(yayin(c, SIFIRLA, 7005));
    }

    // ---------------- son haberler (kayan satır) ----------------

    /** Bir yakının ya da kendinin son durumunu kaydeder. tur: iyi | sonra | yardim | ben_iyi | ben_yardim */
    static synchronized void olayEkle(Context c, String kimId, String ad, String tur, long zaman) {
        try {
            JSONArray eski = new JSONArray(Ortak.tercih(c).getString("widget_olaylar", "[]"));
            JSONArray yeni = new JSONArray();
            JSONObject o = new JSONObject();
            o.put("id", kimId);
            o.put("ad", ad);
            o.put("tur", tur);
            o.put("zaman", zaman);
            yeni.put(o);
            for (int i = 0; i < eski.length() && yeni.length() < 6; i++) {
                JSONObject e = eski.getJSONObject(i);
                if (kimId.equals(e.optString("id"))) continue; // kişi başına en son haber
                yeni.put(e);
            }
            Ortak.tercih(c).edit().putString("widget_olaylar", yeni.toString()).apply();
        } catch (Exception ignored) {}
        ciz(c);
    }

    /** Uygulama açılınca sunucudaki güncel durumlarla listeyi tazeler (kendi kaydın korunur). */
    static synchronized void olaylariYaz(Context c, JSONArray liste) {
        try {
            JSONArray eski = new JSONArray(Ortak.tercih(c).getString("widget_olaylar", "[]"));
            java.util.List<JSONObject> hepsi = new java.util.ArrayList<>();
            for (int i = 0; i < liste.length(); i++) hepsi.add(liste.getJSONObject(i));
            for (int i = 0; i < eski.length(); i++) {
                JSONObject e = eski.getJSONObject(i);
                if ("ben".equals(e.optString("id"))) hepsi.add(e);
            }
            java.util.Collections.sort(hepsi, (a, b) -> Long.compare(b.optLong("zaman"), a.optLong("zaman")));
            JSONArray yeni = new JSONArray();
            for (JSONObject o : hepsi) {
                if (yeni.length() >= 6) break;
                yeni.put(o);
            }
            Ortak.tercih(c).edit().putString("widget_olaylar", yeni.toString()).apply();
        } catch (Exception ignored) {}
        ciz(c);
    }

    private static String once(Context c, long zaman) {
        long dk = Math.max(0, (System.currentTimeMillis() - zaman) / 60000);
        if (dk < 1) return Ortak.s(c, R.string.w_simdi);
        if (dk < 60) return Ortak.s(c, R.string.w_dk_once, (int) dk);
        return Ortak.s(c, R.string.w_sa_once, (int) (dk / 60));
    }

    /** Son 4 saatin haberleri, en yeni önce: {metin, renk} */
    private static java.util.List<Object[]> haberler(Context c) {
        java.util.List<Object[]> l = new java.util.ArrayList<>();
        Locale yer = Ortak.yerelAyar(c);
        int yesil = c.getColor(R.color.w_iyi), kirmizi = c.getColor(R.color.w_tehlike), sari = c.getColor(R.color.w_bekle);
        try {
            JSONArray a = new JSONArray(Ortak.tercih(c).getString("widget_olaylar", "[]"));
            long sinir = System.currentTimeMillis() - HABER_OMRU;
            for (int i = 0; i < a.length() && l.size() < 5; i++) {
                JSONObject o = a.getJSONObject(i);
                long z = o.optLong("zaman");
                if (z < sinir) continue;
                String ad = o.optString("ad");
                String ne = once(c, z);
                String metin;
                int renk;
                switch (o.optString("tur")) {
                    case "yardim": metin = Ortak.s(c, R.string.w_ak_yardim, ne, ad); renk = kirmizi; break;
                    case "sonra": metin = Ortak.s(c, R.string.w_ak_sonra, ne, ad); renk = sari; break;
                    case "ben_iyi": metin = Ortak.s(c, R.string.w_ak_ben_iyi, ne); renk = yesil; break;
                    case "ben_yardim": metin = Ortak.s(c, R.string.w_ak_ben_yardim, ne); renk = kirmizi; break;
                    default: metin = Ortak.s(c, R.string.w_ak_iyi, ne, ad); renk = yesil;
                }
                l.add(new Object[]{metin.toUpperCase(yer), renk});
            }
        } catch (Exception ignored) {}
        return l;
    }

    // ---------------- düğme olayları (WidgetAlici'dan gelir) ----------------

    static void eylem(BroadcastReceiver alici, Context context, Intent intent) {
        final Context c = context.getApplicationContext();
        String e = intent.getAction();
        if (e == null) return;

        if (!girisVar(c) && (IYI.equals(e) || YARDIM.equals(e))) {
            c.startActivity(uygulamaIntent(c));
            return;
        }

        if (IYI.equals(e)) {
            durumYaz(c, Ortak.s(c, R.string.gonderiliyor));
            final BroadcastReceiver.PendingResult sonuc = alici.goAsync();
            new Thread(() -> {
                try {
                    JSONObject g = new JSONObject();
                    g.put("cevap", "iyi");
                    Object[] r = Ortak.istek(c, "POST", "/herkese", g);
                    int kod = (Integer) r[0];
                    if (kod >= 200 && kod < 300) {
                        int kisi = new JSONObject((String) r[1]).optInt("kisi", 0);
                        olayEkle(c, "ben", "", "ben_iyi", System.currentTimeMillis());
                        durumYaz(c, Ortak.s(c, R.string.w_gitti, kisi));
                    } else if (kod == 402) {
                        Ortak.tercih(c).edit().putBoolean("tam_goster", true).apply();
                        durumYaz(c, Ortak.s(c, R.string.w_tam_gerekli));
                    } else if (kod == 429) {
                        durumYaz(c, Ortak.s(c, R.string.w_az_once));
                    } else if (kod == -1) {
                        durumYaz(c, Ortak.s(c, R.string.w_internet_yok));
                    } else {
                        durumYaz(c, Ortak.s(c, R.string.w_gonderilemedi));
                    }
                } catch (Exception ex) {
                    durumYaz(c, Ortak.s(c, R.string.w_gonderilemedi));
                } finally {
                    sonuc.finish();
                }
            }).start();
        } else if (YARDIM.equals(e)) {
            // 1. dokunuş: onay iste. 2. dokunuş (5 sn içinde) YardimActivity'yi açar.
            Ortak.tercih(c).edit().putLong("widget_onay", System.currentTimeMillis()).apply();
            ciz(c);
            final BroadcastReceiver.PendingResult sonuc = alici.goAsync();
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                ciz(c);
                sonuc.finish();
            }, ONAY_SURESI + 200);
        } else if (SIFIRLA.equals(e)) {
            ciz(c);
        }
    }

    private static boolean girisVar(Context c) {
        return !Ortak.tercih(c).getString("id", "").isEmpty();
    }

    static Intent uygulamaIntent(Context c) {
        Intent i = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (i == null) i = new Intent(c, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return i;
    }

    static String saat() {
        return new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date());
    }

    /** Kısa süreli bilgi satırı (Gönderiliyor…, hata vb.); 20 saniye görünür. */
    static void durumYaz(Context c, String metin) {
        Ortak.tercih(c).edit().putString("widget_durum", metin).putLong("widget_durum_zaman", System.currentTimeMillis()).apply();
        ciz(c);
        new Handler(Looper.getMainLooper()).postDelayed(() -> ciz(c), 21000);
    }

    /** Düğme yayınları yalnızca uygulamanın kendi (dışa kapalı) alıcısına gider. */
    private static PendingIntent yayin(Context c, String eylem, int no) {
        Intent i = new Intent(c, WidgetAlici.class).setAction(eylem);
        return PendingIntent.getBroadcast(c, no, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // ---------------- çizim ----------------

    /** Tüm widget'ları güncel duruma ve boyutlarına göre yeniden çizer. */
    static void ciz(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] idler = m.getAppWidgetIds(new ComponentName(c, IyiyimWidget.class));
        if (idler == null || idler.length == 0) return;
        for (int id : idler) {
            try {
                if (Build.VERSION.SDK_INT >= 31) {
                    // Android 12+: başlatıcı, boyuta uyan düzeni kendisi seçer
                    Map<SizeF, RemoteViews> duzenler = new HashMap<>();
                    duzenler.put(new SizeF(100f, 40f), gorunum(c, KUCUK));
                    duzenler.put(new SizeF(100f, 112f), gorunum(c, ORTA));
                    duzenler.put(new SizeF(100f, 168f), gorunum(c, BUYUK));
                    m.updateAppWidget(id, new RemoteViews(duzenler));
                } else {
                    Bundle o = m.getAppWidgetOptions(id);
                    int yukseklik = o != null ? o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0) : 0;
                    if (yukseklik <= 0 && o != null) yukseklik = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
                    int boy = yukseklik <= 0 ? BUYUK : yukseklik < 112 ? KUCUK : yukseklik < 168 ? ORTA : BUYUK;
                    m.updateAppWidget(id, gorunum(c, boy));
                }
            } catch (Exception ignored) {}
        }
    }

    private static RemoteViews gorunum(Context c, int boy) {
        int duzen = boy == KUCUK ? R.layout.widget_iyiyim_kucuk : boy == ORTA ? R.layout.widget_iyiyim_orta : R.layout.widget_iyiyim;
        RemoteViews v = new RemoteViews(c.getPackageName(), duzen);

        // haberler
        java.util.List<Object[]> h = haberler(c);
        if (boy == BUYUK) {
            v.removeAllViews(R.id.w_akis);
            if (h.isEmpty()) h.add(new Object[]{Ortak.s(c, R.string.w_bos).toUpperCase(Ortak.yerelAyar(c)), c.getColor(R.color.widget_soluk)});
            for (Object[] x : h) {
                RemoteViews satir = new RemoteViews(c.getPackageName(), R.layout.widget_akis_satir);
                satir.setTextViewText(R.id.w_satir, (String) x[0]);
                satir.setTextColor(R.id.w_satir, (Integer) x[1]);
                v.addView(R.id.w_akis, satir);
            }
        } else if (boy == ORTA) {
            if (h.isEmpty()) {
                v.setTextViewText(R.id.w_tek, Ortak.s(c, R.string.w_bos));
                v.setTextColor(R.id.w_tek, c.getColor(R.color.widget_soluk));
            } else {
                v.setTextViewText(R.id.w_tek, (String) h.get(0)[0]);
                v.setTextColor(R.id.w_tek, (Integer) h.get(0)[1]);
            }
        }

        // geçici bilgi satırı
        long dz = Ortak.tercih(c).getLong("widget_durum_zaman", 0);
        String gecici = System.currentTimeMillis() - dz < 20000 ? Ortak.tercih(c).getString("widget_durum", "") : "";
        boolean giris = girisVar(c);
        long onay = Ortak.tercih(c).getLong("widget_onay", 0);
        boolean onayda = System.currentTimeMillis() - onay < ONAY_SURESI;
        if (!giris) gecici = Ortak.s(c, R.string.w_giris_yok);
        else if (onayda) gecici = Ortak.s(c, R.string.w_yardim_onay_bilgi);
        v.setViewVisibility(R.id.w_durum, gecici.isEmpty() ? View.GONE : View.VISIBLE);
        v.setTextViewText(R.id.w_durum, gecici);
        if (boy == ORTA) v.setViewVisibility(R.id.w_tek, gecici.isEmpty() ? View.VISIBLE : View.GONE);

        // düğmeler
        v.setTextViewText(R.id.w_iyi_yazi, Ortak.s(c, R.string.w_iyi));
        if (!giris) {
            PendingIntent ac = PendingIntent.getActivity(c, 7001, uygulamaIntent(c),
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            v.setOnClickPendingIntent(R.id.w_iyi, ac);
            v.setOnClickPendingIntent(R.id.w_yardim, ac);
            v.setTextViewText(R.id.w_yardim_yazi, Ortak.s(c, R.string.w_yardim));
        } else {
            v.setOnClickPendingIntent(R.id.w_iyi, yayin(c, IYI, 7002));
            if (onayda) {
                Intent y = new Intent(c, YardimActivity.class);
                y.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                v.setOnClickPendingIntent(R.id.w_yardim, PendingIntent.getActivity(c, 7003, y,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
                String onayMetni = Ortak.s(c, R.string.w_yardim_onay);
                v.setTextViewText(R.id.w_yardim_yazi, boy == KUCUK ? onayMetni.replace('\n', ' ') : onayMetni);
                v.setInt(R.id.w_yardim, "setBackgroundResource", R.drawable.widget_btn_yardim_onay);
            } else {
                v.setOnClickPendingIntent(R.id.w_yardim, yayin(c, YARDIM, 7004));
                v.setTextViewText(R.id.w_yardim_yazi, Ortak.s(c, R.string.w_yardim));
                v.setInt(R.id.w_yardim, "setBackgroundResource", R.drawable.widget_btn_yardim);
            }
        }
        return v;
    }
}
