package com.matali.iyiyim;

import android.content.Context;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** "İyi misin?" ekranının görünümü. Hem SoruActivity hem de üst pencere bunu kullanır. */
final class SoruGorunumu {
    private SoruGorunumu() {}

    interface Secim {
        void secildi(String cevap);
    }

    static final int ZEMIN = 0xFF0B0F14;
    private static final int YUZEY = 0xFF1C2430;
    private static final int CIZGI = 0xFF263040;
    private static final int YAZI = 0xFFEEF3F1;
    private static final int SOLUK = 0xFF8B97A6;
    private static final int IYI = 0xFF5CF2C6;
    private static final int IYI_YAZI = 0xFF06281F;
    private static final int TEHLIKE = 0xFFFF5E6E;
    private static final int TEHLIKE_ZEMIN = 0xFF2E1A20;

    static int dp(Context c, int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, c.getResources().getDisplayMetrics()));
    }

    /** Durum yazısını değiştirmek için döndürülen görünümün etiketi ("durum") kullanılır. */
    static LinearLayout olustur(Context c, String ad, Secim secim) {
        LinearLayout kok = new LinearLayout(c);
        kok.setOrientation(LinearLayout.VERTICAL);
        kok.setGravity(Gravity.CENTER);
        kok.setBackgroundColor(ZEMIN);
        kok.setFitsSystemWindows(true);
        kok.setPadding(dp(c, 26), dp(c, 24), dp(c, 26), dp(c, 24));
        kok.setClickable(true);

        TextView ust = new TextView(c);
        ust.setText(ad + " soruyor");
        ust.setTextColor(SOLUK);
        ust.setTextSize(TypedValue.COMPLEX_UNIT_SP, 19);
        ust.setGravity(Gravity.CENTER);
        kok.addView(ust);

        TextView baslik = new TextView(c);
        baslik.setText("İyi misin?");
        baslik.setTextColor(YAZI);
        baslik.setTypeface(Typeface.DEFAULT_BOLD);
        baslik.setTextSize(TypedValue.COMPLEX_UNIT_SP, 48);
        baslik.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        bl.topMargin = dp(c, 8);
        bl.bottomMargin = dp(c, 36);
        kok.addView(baslik, bl);

        kok.addView(dugme(c, "İyiyim", "iyi", IYI, IYI_YAZI, 0, 84, 26, secim));
        kok.addView(dugme(c, "Sonra ararım", "sonra", YUZEY, YAZI, CIZGI, 64, 20, secim));
        kok.addView(dugme(c, "Yardım lazım", "yardim", TEHLIKE_ZEMIN, TEHLIKE, 0x80FF5E6E, 64, 20, secim));

        TextView not = new TextView(c);
        not.setTag("durum");
        not.setText("Cevabın " + ad + " kişisine hemen iletilir. “Yardım lazım” dersen konumun da gönderilir.");
        not.setTextColor(SOLUK);
        not.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        not.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams nl = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        nl.topMargin = dp(c, 20);
        kok.addView(not, nl);
        return kok;
    }

    static void durumYaz(View kok, String metin) {
        View v = kok.findViewWithTag("durum");
        if (v instanceof TextView) ((TextView) v).setText(metin);
    }

    static void dugmeleriKilitle(LinearLayout kok) {
        for (int i = 0; i < kok.getChildCount(); i++) {
            View v = kok.getChildAt(i);
            if (v instanceof Button) {
                v.setEnabled(false);
                v.setAlpha(0.5f);
            }
        }
    }

    private static Button dugme(Context c, String metin, String cevap, int zemin, int renk, int cerceve,
                                int yukseklikDp, int boyutSp, Secim secim) {
        Button b = new Button(c);
        b.setText(metin);
        b.setAllCaps(false);
        b.setTextColor(renk);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, boyutSp);
        b.setStateListAnimator(null);
        GradientDrawable g = new GradientDrawable();
        g.setColor(zemin);
        g.setCornerRadius(dp(c, 20));
        if (cerceve != 0) g.setStroke(dp(c, 2), cerceve);
        b.setBackground(g);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(c, yukseklikDp));
        lp.topMargin = dp(c, 12);
        b.setLayoutParams(lp);
        b.setOnClickListener(v -> secim.secildi(cevap));
        return b;
    }
}
