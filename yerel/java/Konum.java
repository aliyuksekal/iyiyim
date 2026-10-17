package com.matali.iyiyim;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Handler;
import android.os.Looper;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.gms.tasks.CancellationTokenSource;

import org.json.JSONObject;

/** "Yardım lazım" dendiğinde anlık konumu tek seferlik alır. Arka planda konum izlenmez. */
public final class Konum {
    private Konum() {}

    public interface Sonuc {
        /** Konum alınamazsa null gelir. */
        void bitti(JSONObject konum);
    }

    static boolean izinVar(Context c) {
        return c.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || c.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    static JSONObject json(Location l) {
        if (l == null) return null;
        try {
            JSONObject o = new JSONObject();
            o.put("lat", l.getLatitude());
            o.put("lng", l.getLongitude());
            o.put("hassas", l.hasAccuracy() ? Math.round(l.getAccuracy()) : JSONObject.NULL);
            o.put("zaman", l.getTime());
            return o;
        } catch (Exception e) {
            return null;
        }
    }

    /** En fazla ~10 saniye bekler; anlık konum gelmezse son bilinen konumu verir. */
    @android.annotation.SuppressLint("MissingPermission")
    static void al(Context context, Sonuc sonuc) {
        final Context c = context.getApplicationContext();
        final Handler ana = new Handler(Looper.getMainLooper());
        final boolean[] bitti = {false};
        if (!izinVar(c)) {
            sonuc.bitti(null);
            return;
        }
        final FusedLocationProviderClient f = LocationServices.getFusedLocationProviderClient(c);
        final CancellationTokenSource iptal = new CancellationTokenSource();

        final Runnable sonBilinen = () -> {
            try {
                f.getLastLocation().addOnCompleteListener(t -> {
                    synchronized (bitti) {
                        if (bitti[0]) return;
                        bitti[0] = true;
                    }
                    sonuc.bitti(t.isSuccessful() ? json(t.getResult()) : null);
                });
            } catch (Exception e) {
                synchronized (bitti) {
                    if (bitti[0]) return;
                    bitti[0] = true;
                }
                sonuc.bitti(null);
            }
        };

        // Zaman aşımı
        ana.postDelayed(() -> {
            synchronized (bitti) {
                if (bitti[0]) return;
            }
            iptal.cancel();
            sonBilinen.run();
        }, 10000);

        try {
            f.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, iptal.getToken()).addOnCompleteListener(t -> {
                Location l = t.isSuccessful() ? t.getResult() : null;
                if (l == null) {
                    sonBilinen.run();
                    return;
                }
                synchronized (bitti) {
                    if (bitti[0]) return;
                    bitti[0] = true;
                }
                sonuc.bitti(json(l));
            });
        } catch (Exception e) {
            sonBilinen.run();
        }
    }
}
