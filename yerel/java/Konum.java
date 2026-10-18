package com.matali.iyiyim;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import com.google.android.gms.common.api.ResolvableApiException;
import com.google.android.gms.location.CurrentLocationRequest;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.LocationSettingsRequest;
import com.google.android.gms.location.Priority;
import com.google.android.gms.tasks.CancellationTokenSource;

import org.json.JSONObject;

/**
 * "Yardım lazım" dendiğinde anlık konumu tek seferlik alır. Arka planda konum izlenmez.
 * Sıra: telefonun konumu kapalıysa açma penceresi → hassas konum → ağ konumu → son bilinen konum.
 */
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

    /** Telefonun konum hizmeti (GPS/ağ) açık mı? */
    static boolean servisAcik(Context c) {
        LocationManager lm = (LocationManager) c.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return false;
        if (Build.VERSION.SDK_INT >= 28) return lm.isLocationEnabled();
        try {
            return lm.isProviderEnabled(LocationManager.GPS_PROVIDER) || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        } catch (Exception e) {
            return false;
        }
    }

    /** Konum kapalıysa Google'ın "Konumu aç" penceresini gösterir (tek dokunuş). */
    static void acmayiIste(Activity a) {
        if (a == null) return;
        try {
            LocationRequest r = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000).build();
            LocationServices.getSettingsClient(a)
                    .checkLocationSettings(new LocationSettingsRequest.Builder().addLocationRequest(r).setAlwaysShow(true).build())
                    .addOnFailureListener(e -> {
                        if (e instanceof ResolvableApiException) {
                            try {
                                ((ResolvableApiException) e).startResolutionForResult(a, 61);
                            } catch (Exception ignored) {}
                        }
                    });
        } catch (Exception ignored) {}
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

    /** Konum servisi kapalıysa açılmasını en fazla bu kadar bekler. */
    private static final long ACILMA_BEKLEME = 15000;

    /** En fazla ~20 saniyede sonuç verir. Etkinlikten çağrılırsa kapalı konumu açmayı da önerir. */
    static void al(Context context, Sonuc sonuc) {
        final Handler ana = new Handler(Looper.getMainLooper());
        final Context c = context.getApplicationContext();
        if (!izinVar(c)) {
            sonuc.bitti(null);
            return;
        }
        if (servisAcik(c)) {
            getir(c, sonuc);
            return;
        }
        if (context instanceof Activity) acmayiIste((Activity) context);
        // Kullanıcının konumu açmasını bekle; açılmazsa son bilinen konumla devam et
        final long bas = System.currentTimeMillis();
        ana.post(new Runnable() {
            @Override
            public void run() {
                if (servisAcik(c)) {
                    getir(c, sonuc);
                } else if (System.currentTimeMillis() - bas > ACILMA_BEKLEME) {
                    sonBilinen(c, LocationServices.getFusedLocationProviderClient(c), sonuc);
                } else {
                    ana.postDelayed(this, 500);
                }
            }
        });
    }

    @android.annotation.SuppressLint("MissingPermission")
    private static void getir(Context c, Sonuc sonuc) {
        final Handler ana = new Handler(Looper.getMainLooper());
        final boolean[] bitti = {false};
        final FusedLocationProviderClient f = LocationServices.getFusedLocationProviderClient(c);
        final CancellationTokenSource iptal = new CancellationTokenSource();
        final Sonuc tekSefer = k -> {
            synchronized (bitti) {
                if (bitti[0]) return;
                bitti[0] = true;
            }
            iptal.cancel();
            sonuc.bitti(k);
        };

        // 1) Hassas konum (GPS), 2) olmazsa ağ konumu, 3) son bilinen
        final Runnable agKonumu = () -> {
            try {
                CurrentLocationRequest r = new CurrentLocationRequest.Builder()
                        .setPriority(Priority.PRIORITY_BALANCED_POWER_ACCURACY)
                        .setMaxUpdateAgeMillis(5 * 60 * 1000)
                        .setDurationMillis(6000).build();
                f.getCurrentLocation(r, iptal.getToken()).addOnCompleteListener(t -> {
                    Location l = t.isSuccessful() ? t.getResult() : null;
                    if (l != null) tekSefer.bitti(json(l));
                    else sonBilinen(c, f, tekSefer);
                });
            } catch (Exception e) {
                sonBilinen(c, f, tekSefer);
            }
        };

        ana.postDelayed(() -> {
            synchronized (bitti) {
                if (bitti[0]) return;
            }
            agKonumu.run();
        }, 10000);

        try {
            CurrentLocationRequest r = new CurrentLocationRequest.Builder()
                    .setPriority(Priority.PRIORITY_HIGH_ACCURACY)
                    .setMaxUpdateAgeMillis(60 * 1000)
                    .setDurationMillis(10000).build();
            f.getCurrentLocation(r, iptal.getToken()).addOnCompleteListener(t -> {
                Location l = t.isSuccessful() ? t.getResult() : null;
                if (l != null) tekSefer.bitti(json(l));
            });
        } catch (Exception e) {
            agKonumu.run();
        }
        // Son güvenlik: 20 sn'de hiçbir şey gelmezse son bilineni ver
        ana.postDelayed(() -> sonBilinen(c, f, tekSefer), 20000);
    }

    @android.annotation.SuppressLint("MissingPermission")
    private static void sonBilinen(Context c, FusedLocationProviderClient f, Sonuc sonuc) {
        try {
            f.getLastLocation().addOnCompleteListener(t -> {
                Location l = t.isSuccessful() ? t.getResult() : null;
                if (l == null) l = sistemSonBilinen(c);
                sonuc.bitti(json(l));
            });
        } catch (Exception e) {
            sonuc.bitti(json(sistemSonBilinen(c)));
        }
    }

    @android.annotation.SuppressLint("MissingPermission")
    private static Location sistemSonBilinen(Context c) {
        try {
            LocationManager lm = (LocationManager) c.getSystemService(Context.LOCATION_SERVICE);
            Location en = null;
            for (String p : lm.getProviders(true)) {
                Location l = lm.getLastKnownLocation(p);
                if (l != null && (en == null || l.getTime() > en.getTime())) en = l;
            }
            return en;
        } catch (Exception e) {
            return null;
        }
    }
}
