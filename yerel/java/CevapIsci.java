package com.matali.iyiyim;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

/** İnternet yokken verilen cevabı, bağlantı gelince gönderir. */
public class CevapIsci extends Worker {

    public CevapIsci(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        String soruId = getInputData().getString("soruId");
        String cevap = getInputData().getString("cevap");
        String ad = getInputData().getString("ad");
        if (soruId == null || cevap == null) return Result.failure();
        if (ad == null) ad = "";
        try {
            JSONObject g = new JSONObject();
            g.put("soruId", soruId);
            g.put("cevap", cevap);
            Object[] r = Ortak.istek(c, "POST", "/cevap", g);
            int kod = (Integer) r[0];
            if (kod >= 200 && kod < 300) {
                Ortak.kanallariKur(c);
                Ortak.durumGoster(c, Ortak.noSoru(soruId), "Gönderildi ✓",
                        "Bekleyen cevabın " + ad + " kişisine iletildi", 8000);
                JSONObject o = new JSONObject();
                o.put("tip", "cevaplandi");
                o.put("soruId", soruId);
                o.put("cevap", cevap);
                Ortak.olay(c, o);
                return Result.success();
            }
            if (kod >= 400 && kod < 500) return Result.failure(); // soru silinmiş vb.
            return getRunAttemptCount() < 20 ? Result.retry() : Result.failure();
        } catch (Exception e) {
            return Result.retry();
        }
    }
}
