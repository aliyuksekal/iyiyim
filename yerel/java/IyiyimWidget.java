package com.matali.iyiyim;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Ana ekran düğmesi: uygulamayı açmadan herkese "İyiyim" de ya da konumla yardım iste.
 * Yaşlılar için iki büyük düğme; "Yardım iste" yanlışlıkla basılmasın diye iki dokunuş ister.
 */
public class IyiyimWidget extends AppWidgetProvider {

    static final String IYI = "com.matali.iyiyim.WIDGET_IYI";
    static final String YARDIM = "com.matali.iyiyim.WIDGET_YARDIM";
    static final String SIFIRLA = "com.matali.iyiyim.WIDGET_SIFIRLA";
    private static final long ONAY_SURESI = 5000;

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] idler) {
        ciz(c);
    }

    @Override
    public void onEnabled(Context c) {
        // "5 DK ÖNCE" yazıları eskimesin diye widget 15 dakikada bir tazelenir
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

    private static String once(long zaman) {
        long dk = Math.max(0, (System.currentTimeMillis() - zaman) / 60000);
        if (dk < 1) return "ŞİMDİ";
        if (dk < 60) return dk + " DK ÖNCE";
        long sa = dk / 60;
        return sa + " SAAT ÖNCE";
    }

    private static final int YESIL = 0xFF2BC48F, KIRMIZI = 0xFFE5484D, SARI = 0xFFE0A030;

    private static void akisDoldur(Context c, RemoteViews v) {
        v.removeAllViews(R.id.w_akis);
        Locale tr = new Locale("tr");
        int eklenen = 0;
        try {
            JSONArray l = new JSONArray(Ortak.tercih(c).getString("widget_olaylar", "[]"));
            long gun = System.currentTimeMillis() - 24L * 60 * 60 * 1000;
            for (int i = 0; i < l.length() && eklenen < 5; i++) {
                JSONObject o = l.getJSONObject(i);
                long z = o.optLong("zaman");
                if (z < gun) continue;
                String ad = o.optString("ad").toUpperCase(tr);
                String tur = o.optString("tur");
                String metin;
                int renk;
                switch (tur) {
                    case "yardim": metin = once(z) + " " + ad + " YARDIM İSTEDİ"; renk = KIRMIZI; break;
                    case "sonra": metin = once(z) + " " + ad + " SONRA ARAYACAK"; renk = SARI; break;
                    case "ben_iyi": metin = once(z) + " SEN “İYİYİM” DEDİN"; renk = YESIL; break;
                    case "ben_yardim": metin = once(z) + " YARDIM İSTEDİN"; renk = KIRMIZI; break;
                    default: metin = once(z) + " " + ad + " İYİYİM DEDİ"; renk = YESIL;
                }
                RemoteViews satir = new RemoteViews(c.getPackageName(), R.layout.widget_akis_satir);
                satir.setTextViewText(R.id.w_satir, metin);
                satir.setTextColor(R.id.w_satir, renk);
                v.addView(R.id.w_akis, satir);
                eklenen++;
            }
        } catch (Exception ignored) {}
        if (eklenen == 0) {
            RemoteViews satir = new RemoteViews(c.getPackageName(), R.layout.widget_akis_satir);
            satir.setTextViewText(R.id.w_satir, "TEK DOKUNUŞLA HABER VER");
            v.addView(R.id.w_akis, satir);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        final Context c = context.getApplicationContext();
        String e = intent.getAction();
        if (e == null) return;

        if (!girisVar(c) && (IYI.equals(e) || YARDIM.equals(e))) {
            c.startActivity(uygulamaIntent(c));
            return;
        }

        if (IYI.equals(e)) {
            durumYaz(c, "Gönderiliyor…");
            final PendingResult sonuc = goAsync();
            new Thread(() -> {
                try {
                    JSONObject g = new JSONObject();
                    g.put("cevap", "iyi");
                    Object[] r = Ortak.istek(c, "POST", "/herkese", g);
                    int kod = (Integer) r[0];
                    if (kod >= 200 && kod < 300) {
                        int kisi = new JSONObject((String) r[1]).optInt("kisi", 0);
                        olayEkle(c, "ben", "Sen", "ben_iyi", System.currentTimeMillis());
                        durumYaz(c, "✓ " + kisi + " kişiye gitti");
                    } else if (kod == 402) {
                        Ortak.tercih(c).edit().putBoolean("tam_goster", true).apply();
                        durumYaz(c, "İyiyim Tam gerekli · uygulamayı aç");
                    } else if (kod == 429) {
                        durumYaz(c, "Az önce bildirdin, biraz sonra tekrar dene");
                    } else if (kod == -1) {
                        durumYaz(c, "İnternet yok, bağlanınca tekrar dokun");
                    } else {
                        durumYaz(c, "Gönderilemedi, tekrar dokun");
                    }
                } catch (Exception ex) {
                    durumYaz(c, "Gönderilemedi, tekrar dokun");
                } finally {
                    sonuc.finish();
                }
            }).start();
        } else if (YARDIM.equals(e)) {
            // 1. dokunuş: onay iste. 2. dokunuş (5 sn içinde) YardimActivity'yi açar.
            Ortak.tercih(c).edit().putLong("widget_onay", System.currentTimeMillis()).apply();
            ciz(c);
            final PendingResult sonuc = goAsync();
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
        return new SimpleDateFormat("HH:mm", new Locale("tr")).format(new Date());
    }

    /** Kısa süreli bilgi satırı (Gönderiliyor…, hata vb.); 20 saniye görünür. */
    static void durumYaz(Context c, String metin) {
        Ortak.tercih(c).edit().putString("widget_durum", metin).putLong("widget_durum_zaman", System.currentTimeMillis()).apply();
        ciz(c);
        new Handler(Looper.getMainLooper()).postDelayed(() -> ciz(c), 21000);
    }

    private static PendingIntent yayin(Context c, String eylem, int no) {
        Intent i = new Intent(c, IyiyimWidget.class).setAction(eylem);
        return PendingIntent.getBroadcast(c, no, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Tüm widget'ları güncel duruma göre yeniden çizer. */
    static void ciz(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] idler = m.getAppWidgetIds(new ComponentName(c, IyiyimWidget.class));
        if (idler == null || idler.length == 0) return;

        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_iyiyim);
        akisDoldur(c, v);
        long dz = Ortak.tercih(c).getLong("widget_durum_zaman", 0);
        String gecici = System.currentTimeMillis() - dz < 20000 ? Ortak.tercih(c).getString("widget_durum", "") : "";
        v.setViewVisibility(R.id.w_durum, gecici.isEmpty() ? android.view.View.GONE : android.view.View.VISIBLE);
        v.setTextViewText(R.id.w_durum, gecici);
        boolean giris = girisVar(c);
        long onay = Ortak.tercih(c).getLong("widget_onay", 0);
        boolean onayda = System.currentTimeMillis() - onay < ONAY_SURESI;

        if (!giris) {
            PendingIntent ac = PendingIntent.getActivity(c, 7001, uygulamaIntent(c),
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            v.setOnClickPendingIntent(R.id.w_iyi, ac);
            v.setOnClickPendingIntent(R.id.w_yardim, ac);
            v.setViewVisibility(R.id.w_durum, android.view.View.VISIBLE);
            v.setTextViewText(R.id.w_durum, "Önce İyiyim'i açıp adını yaz");
        } else {
            v.setOnClickPendingIntent(R.id.w_iyi, yayin(c, IYI, 7002));
            if (onayda) {
                Intent y = new Intent(c, YardimActivity.class);
                y.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                v.setOnClickPendingIntent(R.id.w_yardim, PendingIntent.getActivity(c, 7003, y,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
                v.setTextViewText(R.id.w_yardim_yazi, "Göndermek için\ntekrar dokun");
                v.setInt(R.id.w_yardim, "setBackgroundResource", R.drawable.widget_btn_yardim_onay);
                v.setViewVisibility(R.id.w_durum, android.view.View.VISIBLE);
                v.setTextViewText(R.id.w_durum, "Yardım isteği ve konumun tüm yakınlarına gidecek");
            } else {
                v.setOnClickPendingIntent(R.id.w_yardim, yayin(c, YARDIM, 7004));
                v.setTextViewText(R.id.w_yardim_yazi, "Yardım iste");
                v.setInt(R.id.w_yardim, "setBackgroundResource", R.drawable.widget_btn_yardim);
            }
        }
        m.updateAppWidget(idler, v);
    }
}
