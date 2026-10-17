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
                        durumYaz(c, "✓ “İyiyim” " + kisi + " kişiye gitti · " + saat());
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

    static void durumYaz(Context c, String metin) {
        Ortak.tercih(c).edit().putString("widget_durum", metin).apply();
        ciz(c);
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
        boolean giris = girisVar(c);
        long onay = Ortak.tercih(c).getLong("widget_onay", 0);
        boolean onayda = System.currentTimeMillis() - onay < ONAY_SURESI;

        if (!giris) {
            PendingIntent ac = PendingIntent.getActivity(c, 7001, uygulamaIntent(c),
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            v.setOnClickPendingIntent(R.id.w_iyi, ac);
            v.setOnClickPendingIntent(R.id.w_yardim, ac);
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
                v.setTextViewText(R.id.w_durum, "Yardım isteği ve konumun tüm yakınlarına gidecek");
            } else {
                v.setOnClickPendingIntent(R.id.w_yardim, yayin(c, YARDIM, 7004));
                v.setTextViewText(R.id.w_yardim_yazi, "Yardım iste");
                v.setInt(R.id.w_yardim, "setBackgroundResource", R.drawable.widget_btn_yardim);
                v.setTextViewText(R.id.w_durum, Ortak.tercih(c).getString("widget_durum", "İyiyim · tek dokunuşla haber ver"));
            }
        }
        m.updateAppWidget(idler, v);
    }
}
