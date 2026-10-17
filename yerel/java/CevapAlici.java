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
        final String ad = intent.getStringExtra("ad") != null ? intent.getStringExtra("ad") : "";
        Ortak.kanallariKur(c);
        Ortak.kapat(c, Ortak.noSoru(soruId));
        Ortak.durumGoster(c, Ortak.noSoru(soruId), "Gönderiliyor…", ad + " kişisine cevabın iletiliyor", 0);

        final PendingResult sonuc = goAsync();
        new Thread(() -> {
            try {
                JSONObject g = new JSONObject();
                g.put("soruId", soruId);
                g.put("cevap", cevap);
                Object[] r = Ortak.istek(c, "POST", "/cevap", g);
                int kod = (Integer) r[0];
                if (kod >= 200 && kod < 300) {
                    String metin = "yardim".equals(cevap) ? "Yardım isteğin " + ad + " kişisine iletildi"
                            : "sonra".equals(cevap) ? "“Sonra ararım” " + ad + " kişisine iletildi"
                            : "“İyiyim” " + ad + " kişisine iletildi";
                    Ortak.durumGoster(c, Ortak.noSoru(soruId), "Gönderildi ✓", metin, 6000);
                    JSONObject o = new JSONObject();
                    o.put("tip", "cevaplandi");
                    o.put("soruId", soruId);
                    o.put("cevap", cevap);
                    Ortak.olay(c, o);
                } else if (kod == 404) {
                    Ortak.durumGoster(c, Ortak.noSoru(soruId), "Bu soru artık geçerli değil", ad + " seni listesinden çıkarmış olabilir", 10000);
                } else {
                    // İnternet yok ya da sunucuya ulaşılamadı: bağlantı gelince kendiliğinden gönder
                    Ortak.cevapSirala(c, soruId, cevap, ad);
                    Ortak.durumGoster(c, Ortak.noSoru(soruId), "İnternet bekleniyor",
                            "Cevabın internete bağlanınca otomatik gönderilecek", 0);
                }
            } catch (Exception e) {
                Ortak.cevapSirala(c, soruId, cevap, ad);
                Ortak.durumGoster(c, Ortak.noSoru(soruId), "İnternet bekleniyor",
                        "Cevabın internete bağlanınca otomatik gönderilecek", 0);
            } finally {
                sonuc.finish();
            }
        }).start();
    }
}
