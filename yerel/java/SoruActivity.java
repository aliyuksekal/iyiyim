package com.matali.iyiyim;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.LinearLayout;

import org.json.JSONObject;

/**
 * "İyi misin?" sorusu geldiğinde kilit ekranının ve diğer uygulamaların üstünde açılan ekran.
 * Cevap verilmeden geri tuşuyla kapanmaz. "Yardım lazım"da anlık konumu da gönderir.
 */
public class SoruActivity extends Activity {

    private static final int KONUM_ISTEGI = 41;

    private String soruId;
    private String ad;
    private LinearLayout kok;
    private boolean gonderiliyor = false;

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
        getWindow().setStatusBarColor(SoruGorunumu.ZEMIN);
        getWindow().setNavigationBarColor(SoruGorunumu.ZEMIN);
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, () -> { });
        }
        hazirla(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        gonderiliyor = false;
        hazirla(intent);
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        // Cevap vermeden kapanmaz
    }

    private void hazirla(Intent i) {
        soruId = i != null ? i.getStringExtra("soruId") : null;
        ad = i != null ? i.getStringExtra("ad") : null;
        if (ad == null) ad = "";
        if (soruId == null) {
            finish();
            return;
        }
        UstPencere.kaldir(this, soruId);
        kok = SoruGorunumu.olustur(this, ad, this::secildi);
        setContentView(kok);
        if ("yardim".equals(i.getStringExtra("otomatik"))) secildi("yardim");
    }

    private void secildi(String cevap) {
        if (gonderiliyor) return;
        if (!"yardim".equals(cevap)) {
            gonder(cevap, null);
            return;
        }
        gonderiliyor = true;
        SoruGorunumu.dugmeleriKilitle(kok);
        if (Konum.izinVar(this)) {
            konumlaGonder();
        } else if (Build.VERSION.SDK_INT >= 23) {
            SoruGorunumu.durumYaz(kok, "Konumunu göndermek için izin ver…");
            requestPermissions(new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION}, KONUM_ISTEGI);
        } else {
            gonder("yardim", null);
        }
    }

    @Override
    public void onRequestPermissionsResult(int kod, String[] izinler, int[] sonuclar) {
        super.onRequestPermissionsResult(kod, izinler, sonuclar);
        if (kod != KONUM_ISTEGI) return;
        if (Konum.izinVar(this)) konumlaGonder();
        else gonder("yardim", null); // izin yoksa konumsuz gönder, yardım isteği gecikmesin
    }

    private void konumlaGonder() {
        SoruGorunumu.durumYaz(kok, "Konumun alınıyor ve yardım isteğin gönderiliyor…");
        Konum.al(this, konum -> runOnUiThread(() -> gonder("yardim", konum)));
    }

    private void gonder(String cevap, JSONObject konum) {
        Intent i = new Intent(this, CevapAlici.class);
        i.setAction("com.matali.iyiyim.CEVAP." + cevap);
        i.putExtra("soruId", soruId);
        i.putExtra("cevap", cevap);
        i.putExtra("ad", ad);
        if (konum != null) i.putExtra("konum", konum.toString());
        sendBroadcast(i);
        finish();
    }
}
