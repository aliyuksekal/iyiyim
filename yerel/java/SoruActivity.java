package com.matali.iyiyim;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * "İyi misin?" sorusu geldiğinde diğer uygulamaların ve kilit ekranının üstünde açılan ekran.
 * Cevap verilmeden geri tuşuyla kapanmaz.
 */
public class SoruActivity extends Activity {

    private static final int ZEMIN = 0xFF0B0F14;
    private static final int YUZEY = 0xFF1C2430;
    private static final int CIZGI = 0xFF263040;
    private static final int YAZI = 0xFFEEF3F1;
    private static final int SOLUK = 0xFF8B97A6;
    private static final int IYI = 0xFF5CF2C6;
    private static final int IYI_YAZI = 0xFF06281F;
    private static final int TEHLIKE = 0xFFFF5E6E;
    private static final int TEHLIKE_ZEMIN = 0xFF2E1A20;

    private String soruId;
    private String ad;

    @Override
    protected void onCreate(Bundle kayit) {
        super.onCreate(kayit);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(ZEMIN);
        getWindow().setNavigationBarColor(ZEMIN);
        if (Build.VERSION.SDK_INT >= 33) {
            // Geri hareketi yut: cevap vermeden kapanmasın
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, () -> { });
        }
        oku(getIntent());
        kur();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        oku(intent);
        kur();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        // Cevap vermeden kapanmaz
    }

    private void oku(Intent i) {
        soruId = i != null ? i.getStringExtra("soruId") : null;
        ad = i != null ? i.getStringExtra("ad") : null;
        if (ad == null) ad = "";
    }

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }

    private void kur() {
        if (soruId == null) {
            finish();
            return;
        }
        LinearLayout kok = new LinearLayout(this);
        kok.setOrientation(LinearLayout.VERTICAL);
        kok.setGravity(Gravity.CENTER);
        kok.setBackgroundColor(ZEMIN);
        kok.setFitsSystemWindows(true);
        kok.setPadding(dp(26), dp(24), dp(26), dp(24));

        TextView ust = new TextView(this);
        ust.setText(ad + " soruyor");
        ust.setTextColor(SOLUK);
        ust.setTextSize(TypedValue.COMPLEX_UNIT_SP, 19);
        ust.setGravity(Gravity.CENTER);
        kok.addView(ust);

        TextView baslik = new TextView(this);
        baslik.setText("İyi misin?");
        baslik.setTextColor(YAZI);
        baslik.setTypeface(Typeface.DEFAULT_BOLD);
        baslik.setTextSize(TypedValue.COMPLEX_UNIT_SP, 48);
        baslik.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        bl.topMargin = dp(8);
        bl.bottomMargin = dp(36);
        kok.addView(baslik, bl);

        kok.addView(dugme("İyiyim", "iyi", IYI, IYI_YAZI, 0, 84, 26));
        kok.addView(dugme("Sonra ararım", "sonra", YUZEY, YAZI, CIZGI, 64, 20));
        kok.addView(dugme("Yardım lazım", "yardim", TEHLIKE_ZEMIN, TEHLIKE, 0x80FF5E6E, 64, 20));

        TextView not = new TextView(this);
        not.setText("Cevabın " + ad + " kişisine hemen iletilir.");
        not.setTextColor(SOLUK);
        not.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        not.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams nl = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        nl.topMargin = dp(20);
        kok.addView(not, nl);

        setContentView(kok);
    }

    private Button dugme(String metin, String cevap, int zemin, int renk, int cerceve, int yukseklikDp, int boyutSp) {
        Button b = new Button(this);
        b.setText(metin);
        b.setAllCaps(false);
        b.setTextColor(renk);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, boyutSp);
        b.setStateListAnimator(null);
        GradientDrawable g = new GradientDrawable();
        g.setColor(zemin);
        g.setCornerRadius(dp(20));
        if (cerceve != 0) g.setStroke(dp(2), cerceve);
        b.setBackground(g);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(yukseklikDp));
        lp.topMargin = dp(12);
        b.setLayoutParams(lp);
        b.setOnClickListener(v -> gonder(cevap));
        return b;
    }

    private void gonder(String cevap) {
        Intent i = new Intent(this, CevapAlici.class);
        i.setAction("com.matali.iyiyim.CEVAP." + cevap);
        i.putExtra("soruId", soruId);
        i.putExtra("cevap", cevap);
        i.putExtra("ad", ad);
        sendBroadcast(i);
        finish();
    }
}
