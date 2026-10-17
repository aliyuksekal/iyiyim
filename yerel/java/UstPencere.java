package com.matali.iyiyim;

import android.content.Context;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;

/**
 * "Diğer uygulamaların üstünde göster" izniyle soruyu, o an hangi uygulama açıksa onun üstünde
 * tam ekran gösterir. (Android 15'te arka plandan ekran açmak yasak olduğu için pencere doğrudan çizilir.)
 */
final class UstPencere {
    private UstPencere() {}

    private static View acik;
    private static String acikSoru;

    static void goster(Context context, String soruId, String ad) {
        final Context c = context.getApplicationContext();
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                kaldirHemen(c);
                WindowManager wm = (WindowManager) c.getSystemService(Context.WINDOW_SERVICE);
                if (wm == null) return;
                final LinearLayout[] kokRef = new LinearLayout[1];
                LinearLayout kok = SoruGorunumu.olustur(c, ad, cevap -> secildi(c, kokRef[0], soruId, ad, cevap));
                kokRef[0] = kok;
                kok.setFocusableInTouchMode(true);
                kok.setOnKeyListener((v, kod, olay) -> kod == KeyEvent.KEYCODE_BACK); // geri tuşuyla kapanmaz

                int tur = Build.VERSION.SDK_INT >= 26
                        ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                        : WindowManager.LayoutParams.TYPE_PHONE;
                WindowManager.LayoutParams p = new WindowManager.LayoutParams(
                        WindowManager.LayoutParams.MATCH_PARENT,
                        WindowManager.LayoutParams.MATCH_PARENT,
                        tur,
                        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                                | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
                        PixelFormat.OPAQUE);
                wm.addView(kok, p);
                kok.requestFocus();
                acik = kok;
                acikSoru = soruId;
            } catch (Exception ignored) {
                // izin yoksa ya da sistem engellediyse bildirim zaten panelde duruyor
            }
        });
    }

    private static void secildi(Context c, LinearLayout kok, String soruId, String ad, String cevap) {
        if ("yardim".equals(cevap)) {
            // Konum yalnızca görünür bir ekrandan alınabilir: soru ekranını aç, konumu orada alıp gönder.
            // Üst pencere görünürken etkinlik başlatmaya izin verilir.
            try {
                c.startActivity(Ortak.soruEkraniIntent(c, soruId, ad, "yardim"));
            } catch (Exception e) {
                gonder(c, soruId, ad, cevap);
            }
        } else {
            gonder(c, soruId, ad, cevap);
        }
        kaldir(c, soruId);
    }

    private static void gonder(Context c, String soruId, String ad, String cevap) {
        Intent i = new Intent(c, CevapAlici.class);
        i.setAction("com.matali.iyiyim.CEVAP." + cevap);
        i.putExtra("soruId", soruId);
        i.putExtra("cevap", cevap);
        i.putExtra("ad", ad);
        c.sendBroadcast(i);
    }

    /** Soru başka bir yoldan cevaplandıysa üst pencereyi kapatır. */
    static void kaldir(Context context, String soruId) {
        final Context c = context.getApplicationContext();
        new Handler(Looper.getMainLooper()).post(() -> {
            if (acik != null && (soruId == null || soruId.equals(acikSoru))) kaldirHemen(c);
        });
    }

    private static void kaldirHemen(Context c) {
        if (acik == null) return;
        try {
            WindowManager wm = (WindowManager) c.getSystemService(Context.WINDOW_SERVICE);
            if (wm != null) wm.removeView(acik);
        } catch (Exception ignored) {}
        acik = null;
        acikSoru = null;
    }
}
