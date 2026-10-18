package com.matali.iyiyim;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONObject;

/** Bildirimdeki "İyiyim / Sonra ararım / Yardım lazım" ve alarmdaki "Sustur" düğmeleri. Uygulamayı açmaz. */
public class CevapAlici extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        final Context c = context.getApplicationContext();
        String eylem = intent.getAction();
        final String soruId = intent.getStringExtra("soruId");
        if (eylem == null || soruId == null) return;

        if (eylem.equals("com.matali.iyiyim.SUSTUR")) {
            Ortak.kapat(c, Ortak.noAlarm(soruId));
            return;
        }
        if (!eylem.startsWith("com.matali.iyiyim.CEVAP.")) return;

        final String cevap = intent.getStringExtra("cevap");
        final String konumMetni = intent.getStringExtra("konum");
        UstPencere.kaldir(c, soruId);
        final String ad = intent.getStringExtra("ad") != null ? intent.getStringExtra("ad") : "";
        Ortak.kanallariKur(c);
        Ortak.kapat(c, Ortak.noSoru(soruId));
        Ortak.durumGoster(c, Ortak.noSoru(soruId), Ortak.s(c, R.string.gonderiliyor), Ortak.s(c, R.string.cevap_iletiliyor, ad), 0);

        final PendingResult sonuc = goAsync();
        new Thread(() -> {
            try {
                JSONObject g = new JSONObject();
                g.put("soruId", soruId);
                g.put("cevap", cevap);
                if (konumMetni != null && !konumMetni.isEmpty()) g.put("konum", new JSONObject(konumMetni));
                Object[] r = Ortak.istek(c, "POST", "/cevap", g);
                int kod = (Integer) r[0];
                if (kod >= 200 && kod < 300) {
                    String metin = "yardim".equals(cevap)
                            ? Ortak.s(c, konumMetni != null && !konumMetni.isEmpty() ? R.string.iletildi_yardim_konum : R.string.iletildi_yardim, ad)
                            : "sonra".equals(cevap) ? Ortak.s(c, R.string.iletildi_sonra, ad)
                            : Ortak.s(c, R.string.iletildi_iyi, ad);
                    Ortak.durumGoster(c, Ortak.noSoru(soruId), Ortak.s(c, R.string.gonderildi), metin, 6000);
                    JSONObject o = new JSONObject();
                    o.put("tip", "cevaplandi");
                    o.put("soruId", soruId);
                    o.put("cevap", cevap);
                    Ortak.olay(c, o);
                } else if (kod == 404) {
                    Ortak.durumGoster(c, Ortak.noSoru(soruId), Ortak.s(c, R.string.soru_gecersiz), Ortak.s(c, R.string.soru_gecersiz_metin, ad), 10000);
                } else {
                    // İnternet yok ya da sunucuya ulaşılamadı: bağlantı gelince kendiliğinden gönder
                    Ortak.cevapSirala(c, soruId, cevap, ad, konumOku(konumMetni));
                    Ortak.durumGoster(c, Ortak.noSoru(soruId), Ortak.s(c, R.string.internet_bekleniyor),
                            Ortak.s(c, R.string.internet_bekleniyor_metin), 0);
                }
            } catch (Exception e) {
                Ortak.cevapSirala(c, soruId, cevap, ad, konumOku(konumMetni));
                Ortak.durumGoster(c, Ortak.noSoru(soruId), Ortak.s(c, R.string.internet_bekleniyor),
                        Ortak.s(c, R.string.internet_bekleniyor_metin), 0);
            } finally {
                sonuc.finish();
            }
        }).start();
    }

    private static JSONObject konumOku(String metin) {
        try {
            return metin == null || metin.isEmpty() ? null : new JSONObject(metin);
        } catch (Exception e) {
            return null;
        }
    }
}
