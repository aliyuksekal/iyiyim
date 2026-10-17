package com.matali.iyiyim;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONArray;
import org.json.JSONObject;

/** Süre dolunca çalışır: cevap gelmiş mi diye son bir kez sunucuya bakar, gelmemişse sesli alarm çalar. */
public class AlarmAlici extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        final Context c = context.getApplicationContext();
        final String soruId = intent.getStringExtra("soruId");
        if (soruId == null) return;
        final JSONObject a = Ortak.alarmAl(c, soruId);
        if (a == null) return; // cevap gelmiş ve alarm iptal edilmiş

        final PendingResult sonuc = goAsync();
        new Thread(() -> {
            try {
                Ortak.kanallariKur(c);
                String kisiId = a.optString("kisiId");
                String ad = a.optString("ad");
                long soruldu = a.optLong("soruldu", System.currentTimeMillis());

                // Bildirim yolda kaybolmuş olabilir: sunucuya sor.
                String cevap = sunucudakiCevap(c, kisiId, soruId);
                Ortak.alarmIptal(c, soruId);
                if (cevap == null || cevap.isEmpty()) {
                    Ortak.alarmCal(c, soruId, kisiId, ad, soruldu, false);
                } else if ("yardim".equals(cevap)) {
                    Ortak.alarmCal(c, soruId, kisiId, ad, soruldu, true);
                } else {
                    Ortak.cevapGoster(c, soruId, ad, cevap);
                }
                JSONObject o = new JSONObject();
                o.put("tip", "alarm");
                o.put("soruId", soruId);
                o.put("ad", ad);
                Ortak.olay(c, o);
            } catch (Exception ignored) {
            } finally {
                sonuc.finish();
            }
        }).start();
    }

    /** Cevap varsa döndürür, yoksa ya da ulaşılamazsa null. */
    private static String sunucudakiCevap(Context c, String kisiId, String soruId) {
        try {
            Object[] r = Ortak.istek(c, "GET", "/kisiler", null);
            if ((Integer) r[0] != 200) return null;
            JSONArray l = new JSONObject((String) r[1]).optJSONArray("kisiler");
            if (l == null) return null;
            for (int i = 0; i < l.length(); i++) {
                JSONObject k = l.getJSONObject(i);
                if (!kisiId.equals(k.optString("id"))) continue;
                JSONObject s = k.optJSONObject("sonSoru");
                if (s != null && soruId.equals(s.optString("id")) && !s.isNull("cevap")) return s.optString("cevap");
            }
        } catch (Exception ignored) {}
        return null;
    }
}
