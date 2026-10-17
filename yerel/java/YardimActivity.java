package com.matali.iyiyim;

import android.Manifest;
import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.widget.Toast;

import org.json.JSONObject;

/**
 * Widget'taki "Yardım iste" ikinci dokunuşta açılır (görünmez ekran):
 * konumu alır, tüm yakınlara yardım isteği gönderir ve kapanır.
 */
public class YardimActivity extends Activity {
    private static final int KONUM_ISTEGI = 52;
    private boolean basladi = false;

    @Override
    protected void onCreate(Bundle kayit) {
        super.onCreate(kayit);
        Ortak.tercih(this).edit().putLong("widget_onay", 0).apply();
        IyiyimWidget.durumYaz(this, "Konum alınıyor, yardım isteği gönderiliyor…");
        Toast.makeText(this, "Yardım isteği gönderiliyor…", Toast.LENGTH_SHORT).show();
        if (Konum.izinVar(this) || Build.VERSION.SDK_INT < 23) {
            basla();
        } else {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION}, KONUM_ISTEGI);
        }
    }

    @Override
    public void onRequestPermissionsResult(int kod, String[] izinler, int[] sonuclar) {
        super.onRequestPermissionsResult(kod, izinler, sonuclar);
        if (kod == KONUM_ISTEGI) basla(); // izin verilmese de yardım konumsuz gider
    }

    private void basla() {
        if (basladi) return;
        basladi = true;
        Konum.al(this, konum -> gonder(konum));
    }

    private void gonder(JSONObject konum) {
        final android.content.Context c = getApplicationContext();
        new Thread(() -> {
            String mesaj;
            try {
                JSONObject g = new JSONObject();
                g.put("cevap", "yardim");
                if (konum != null) g.put("konum", konum);
                Object[] r = Ortak.istek(c, "POST", "/herkese", g);
                int kod = (Integer) r[0];
                if (kod >= 200 && kod < 300) {
                    int kisi = new JSONObject((String) r[1]).optInt("kisi", 0);
                    mesaj = (konum != null ? "Yardım isteğin ve konumun " : "Yardım isteğin ") + kisi + " kişiye gitti · " + IyiyimWidget.saat();
                } else if (kod == -1) {
                    mesaj = "İnternet yok! Bağlanınca tekrar dene ya da 112'yi ara";
                } else {
                    mesaj = "Gönderilemedi, tekrar dene ya da 112'yi ara";
                }
            } catch (Exception e) {
                mesaj = "Gönderilemedi, tekrar dene ya da 112'yi ara";
            }
            final String son = mesaj;
            IyiyimWidget.durumYaz(c, son);
            runOnUiThread(() -> {
                Toast.makeText(c, son, Toast.LENGTH_LONG).show();
                finish();
            });
        }).start();
    }
}
