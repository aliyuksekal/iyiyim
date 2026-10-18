package com.matali.iyiyim;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONObject;

import java.util.Map;

/** Sunucudan gelen anlık bildirimleri karşılar (uygulama kapalıyken de çalışır). */
public class MesajServisi extends FirebaseMessagingService {

    @Override
    public void onNewToken(@NonNull String token) {
        Ortak.tercih(this).edit().putString("token", token).apply();
        new Thread(() -> {
            try {
                JSONObject g = new JSONObject();
                g.put("token", token);
                Ortak.istek(getApplicationContext(), "POST", "/guncelle", g);
            } catch (Exception ignored) {}
        }).start();
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage mesaj) {
        Map<String, String> v = mesaj.getData();
        String tip = v.get("tip");
        if (tip == null) return;
        Ortak.kanallariKur(this);
        String soruId = deger(v, "soruId");
        String kimden = deger(v, "kimden");
        String ad = deger(v, "ad");

        JSONObject olay = new JSONObject();
        try {
            for (Map.Entry<String, String> e : v.entrySet()) olay.put(e.getKey(), e.getValue());
        } catch (Exception ignored) {}

        // Widget'ın kayan satırı için yakınların son haberi
        String widgetTur = null;
        if ("durum".equals(tip) || "cevap".equals(tip)) widgetTur = deger(v, "cevap");
        if (widgetTur != null && !widgetTur.isEmpty()) {
            IyiyimWidget.olayEkle(this, kimden, ad, widgetTur, System.currentTimeMillis());
        }

        switch (tip) {
            case "soru":
                Ortak.soruGoster(this, soruId, ad, null);
                // Uygulama açık değilse soru ekranını diğer uygulamaların üstünde aç
                if (!IyiyimPlugin.onPlandaMi()) Ortak.soruEkraniAc(this, soruId, ad);
                break;

            case "cevap": {
                String cevap = deger(v, "cevap");
                JSONObject a = Ortak.alarmAl(this, soruId);
                long soruldu = a != null ? a.optLong("soruldu", System.currentTimeMillis()) : System.currentTimeMillis();
                Ortak.alarmIptal(this, soruId);
                if ("yardim".equals(cevap)) {
                    Ortak.alarmCal(this, soruId, kimden, ad, soruldu, true,
                            sayi(deger(v, "lat")), sayi(deger(v, "lng")), deger(v, "hassas"));
                } else {
                    Ortak.cevapGoster(this, soruId, ad, cevap);
                }
                break;
            }

            case "durum": {
                String durum = deger(v, "cevap");
                if (!"yardim".equals(durum)) Ortak.kisininAlarmlariniIptal(this, kimden);
                if ("yardim".equals(durum)) {
                    Ortak.kisininAlarmlariniIptal(this, kimden);
                    Ortak.alarmCal(this, "d" + kimden, kimden, ad, System.currentTimeMillis(), true,
                            sayi(deger(v, "lat")), sayi(deger(v, "lng")), deger(v, "hassas"));
                } else {
                    String baslik = "sonra".equals(durum) ? Ortak.s(this, R.string.durum_sonra_baslik, ad) : Ortak.s(this, R.string.durum_iyi_baslik, ad);
                    String metin = "sonra".equals(durum) ? Ortak.s(this, R.string.durum_sonra_metin) : Ortak.s(this, R.string.durum_iyi_metin);
                    Ortak.bilgiGoster(this, ("d" + kimden).hashCode(), baslik, metin);
                }
                break;
            }

            case "deneme":
                Ortak.bilgiGoster(this, 777, Ortak.s(this, R.string.deneme_baslik),
                        "1".equals(deger(v, "gecikmeli")) ? Ortak.s(this, R.string.deneme_gecikmeli) : Ortak.s(this, R.string.deneme_metin));
                break;

            case "eklendi":
                Ortak.bilgiGoster(this, ("e" + kimden).hashCode(), Ortak.s(this, R.string.eklendi_baslik, ad), Ortak.s(this, R.string.eklendi_metin));
                break;

            case "hediye":
                Ortak.bilgiGoster(this, ("h" + kimden).hashCode(), Ortak.s(this, R.string.hediye_baslik, ad),
                        Ortak.s(this, R.string.hediye_metin));
                break;

            case "hediyeKullanildi":
                Ortak.bilgiGoster(this, ("k" + kimden).hashCode(), Ortak.s(this, R.string.hediye_ulasti),
                        Ortak.s(this, R.string.hediye_ulasti_metin, ad));
                break;

            default:
                return;
        }
        Ortak.olay(this, olay);
    }

    private static double sayi(String s) {
        try {
            return s == null || s.isEmpty() ? Double.NaN : Double.parseDouble(s);
        } catch (Exception e) {
            return Double.NaN;
        }
    }

    private static String deger(Map<String, String> v, String k) {
        String s = v.get(k);
        return s == null ? "" : s;
    }
}
