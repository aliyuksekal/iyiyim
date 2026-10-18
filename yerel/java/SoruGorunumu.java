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

    static final int ZEMIN = 0xFF0E1726;
    private static final int YUZEY = 0xFF1D2B42;
    private static final int CIZGI = 0xFF2A3A54;
    private static final int YAZI = 0xFFECF1F8;
    private static final int SOLUK = 0xFF95A3B8;
    private static final int IYI = 0xFF3DD9A0;
    private static final int IYI_YAZI = 0xFF04261A;
    private static final int TEHLIKE = 0xFFFF5D6C;
    private static final int TEHLIKE_ZEMIN = 0xFF3A1D2A;

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
        ust.setText(Ortak.s(c, R.string.soru_ekran_kimden, ad));
        ust.setTextColor(SOLUK);
        ust.setTextSize(TypedValue.COMPLEX_UNIT_SP, 19);
        ust.setGravity(Gravity.CENTER);
        kok.addView(ust);

        TextView baslik = new TextView(c);
        baslik.setText(Ortak.s(c, R.string.soru_ekran_baslik));
        baslik.setTextColor(YAZI);
        baslik.setTypeface(Typeface.DEFAULT_BOLD);
        baslik.setTextSize(TypedValue.COMPLEX_UNIT_SP, 44);
        baslik.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        bl.topMargin = dp(c, 8);
        bl.bottomMargin = dp(c, 36);
        kok.addView(baslik, bl);

        kok.addView(dugme(c, Ortak.s(c, R.string.cevap_iyi), "iyi", IYI, IYI_YAZI, 0, 84, 26, secim));
        kok.addView(dugme(c, Ortak.s(c, R.string.cevap_sonra), "sonra", YUZEY, YAZI, CIZGI, 64, 20, secim));
        kok.addView(dugme(c, Ortak.s(c, R.string.cevap_yardim), "yardim", TEHLIKE_ZEMIN, TEHLIKE, 0x80FF5D6C, 64, 20, secim));

        TextView not = new TextView(c);
        not.setTag("durum");
        not.setText(Ortak.s(c, R.string.soru_ekran_not, ad));
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
