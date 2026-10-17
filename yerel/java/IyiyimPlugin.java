package com.matali.iyiyim;

import android.Manifest;
import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

import java.util.List;

/** Arayüz (JavaScript) ile Android tarafı arasındaki köprü. */
@CapacitorPlugin(
        name = "Iyiyim",
        permissions = {
                @Permission(strings = {Manifest.permission.POST_NOTIFICATIONS}, alias = "bildirim"),
                @Permission(strings = {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, alias = "konum")
        }
)
public class IyiyimPlugin extends Plugin {

    private static IyiyimPlugin ornek;
    private static volatile boolean onPlanda = false;

    @Override
    public void load() {
        ornek = this;
        onPlanda = true;
        Ortak.kanallariKur(getContext());
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        onPlanda = true;
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        onPlanda = false;
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        onPlanda = false;
        if (ornek == this) ornek = null;
    }

    static boolean onPlandaMi() {
        return ornek != null && onPlanda;
    }

    /** Uygulama açıksa olayı doğrudan arayüze iletir; iletemezse false döner (olay kuyruğa alınır). */
    static boolean olayYay(JSONObject o) {
        IyiyimPlugin p = ornek;
        if (p == null || !onPlanda) return false;
        try {
            p.notifyListeners("olay", JSObject.fromJSONObject(o));
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @PluginMethod
    public void ayarla(PluginCall call) {
        Ortak.tercih(getContext()).edit()
                .putString("sunucu", call.getString("sunucu", ""))
                .putString("id", call.getString("id", ""))
                .putString("sifre", call.getString("sifre", ""))
                .apply();
        call.resolve();
    }

    @PluginMethod
    public void jetonAl(PluginCall call) {
        try {
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(t -> {
                JSObject r = new JSObject();
                r.put("token", t.isSuccessful() && t.getResult() != null ? t.getResult() : "");
                call.resolve(r);
            });
        } catch (Exception e) {
            // google-services.json yoksa Firebase başlamaz
            JSObject r = new JSObject();
            r.put("token", "");
            r.put("hata", "Firebase hazır değil");
            call.resolve(r);
        }
    }

    @PluginMethod
    public void bildirimIzni(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("bildirim") == PermissionState.GRANTED) {
            JSObject r = new JSObject();
            r.put("durum", NotificationManagerCompat.from(getContext()).areNotificationsEnabled() ? "granted" : "denied");
            call.resolve(r);
            return;
        }
        requestPermissionForAlias("bildirim", call, "bildirimIzniSonuc");
    }

    @PermissionCallback
    private void bildirimIzniSonuc(PluginCall call) {
        JSObject r = new JSObject();
        r.put("durum", getPermissionState("bildirim") == PermissionState.GRANTED ? "granted" : "denied");
        call.resolve(r);
    }

    @PluginMethod
    public void izinDurumu(PluginCall call) {
        Context c = getContext();
        JSObject r = new JSObject();
        r.put("bildirim", NotificationManagerCompat.from(c).areNotificationsEnabled());
        boolean tam = true;
        if (Build.VERSION.SDK_INT >= 31) {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            tam = am != null && am.canScheduleExactAlarms();
        }
        r.put("tamAlarm", tam);
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        r.put("pilMuaf", pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName()));
        r.put("ustte", Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(c));
        r.put("tamEkran", Ortak.tamEkranIzni(c));
        r.put("konum", Konum.izinVar(c));
        r.put("ton", Ortak.ton(c));
        r.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(r);
    }

    @PluginMethod
    public void usteAyari(PluginCall call) {
        Context c = getContext();
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + c.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
        } catch (Exception e) {
            uygulamaAyarlari(c);
        }
        call.resolve();
    }

    @PluginMethod
    public void bildirimAyari(PluginCall call) {
        Context c = getContext();
        Ortak.kanallariKur(c);
        try {
            Intent i;
            if (Build.VERSION.SDK_INT >= 26) {
                i = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS);
                i.putExtra(Settings.EXTRA_APP_PACKAGE, c.getPackageName());
                i.putExtra(Settings.EXTRA_CHANNEL_ID, Ortak.kanalSoru(c));
            } else {
                i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + c.getPackageName()));
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
        } catch (Exception e) {
            uygulamaAyarlari(c);
        }
        call.resolve();
    }

    // ---------------- kilit ekranı (tam ekran bildirim izni, Android 14+) ----------------
    @PluginMethod
    public void tamEkranAyari(PluginCall call) {
        Context c = getContext();
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                Intent i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + c.getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(i);
            } catch (Exception e) {
                uygulamaAyarlari(c);
            }
        }
        call.resolve();
    }

    // ---------------- konum ----------------
    @PluginMethod
    public void konumIzni(PluginCall call) {
        if (Konum.izinVar(getContext())) {
            JSObject r = new JSObject();
            r.put("durum", "granted");
            call.resolve(r);
            return;
        }
        requestPermissionForAlias("konum", call, "konumIzniSonuc");
    }

    @PermissionCallback
    private void konumIzniSonuc(PluginCall call) {
        JSObject r = new JSObject();
        r.put("durum", Konum.izinVar(getContext()) ? "granted" : "denied");
        call.resolve(r);
    }

    /** Uygulama açıkken "Yardım"a basılınca anlık konum. İzin yoksa önce izin ister. */
    @PluginMethod
    public void konumAl(PluginCall call) {
        if (!Konum.izinVar(getContext())) {
            requestPermissionForAlias("konum", call, "konumAlSonuc");
            return;
        }
        konumuGetir(call);
    }

    @PermissionCallback
    private void konumAlSonuc(PluginCall call) {
        if (!Konum.izinVar(getContext())) {
            call.resolve(new JSObject());
            return;
        }
        konumuGetir(call);
    }

    private void konumuGetir(PluginCall call) {
        Konum.al(getContext(), k -> {
            try {
                call.resolve(k == null ? new JSObject() : JSObject.fromJSONObject(k));
            } catch (Exception e) {
                call.resolve(new JSObject());
            }
        });
    }

    // ---------------- tonlar ----------------
    private static android.media.MediaPlayer calar;

    @PluginMethod
    public void tonSec(PluginCall call) {
        String t = call.getString("ton", "zil");
        Ortak.tercih(getContext()).edit().putString("ton", t).apply();
        Ortak.kanallariKur(getContext());
        JSObject r = new JSObject();
        r.put("ton", Ortak.ton(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void tonDinle(PluginCall call) {
        String t = call.getString("ton", Ortak.ton(getContext()));
        tonDurdurIc();
        try {
            android.media.MediaPlayer m = new android.media.MediaPlayer();
            m.setAudioAttributes(Ortak.yuksekSes());
            m.setDataSource(getContext(), Ortak.tonUri(getContext(), t));
            m.setOnCompletionListener(x -> tonDurdurIc());
            m.prepare();
            m.start();
            calar = m;
        } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void tonDurdur(PluginCall call) {
        tonDurdurIc();
        call.resolve();
    }

    private static synchronized void tonDurdurIc() {
        if (calar != null) {
            try { calar.stop(); } catch (Exception ignored) {}
            try { calar.release(); } catch (Exception ignored) {}
            calar = null;
        }
    }

    // ---------------- geliştiriciyi destekle ----------------
    @PluginMethod
    public void destekFiyati(PluginCall call) {
        Destek.fiyatAl(getContext(), (durum, fiyat, mesaj) -> {
            JSObject r = new JSObject();
            r.put("durum", durum);
            r.put("fiyat", fiyat);
            r.put("mesaj", mesaj);
            call.resolve(r);
        });
    }

    @PluginMethod
    public void destekOl(PluginCall call) {
        if (getActivity() == null) {
            call.reject("Ekran hazır değil");
            return;
        }
        Destek.baslat(getActivity(), (durum, fiyat, mesaj) -> {
            JSObject r = new JSObject();
            r.put("durum", durum);
            r.put("mesaj", mesaj);
            call.resolve(r);
        });
    }

    @PluginMethod
    public void cihaz(PluginCall call) {
        JSObject r = new JSObject();
        r.put("marka", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
        r.put("model", Build.MODEL == null ? "" : Build.MODEL);
        r.put("sdk", Build.VERSION.SDK_INT);
        r.put("surum", Build.VERSION.RELEASE);
        call.resolve(r);
    }

    /** Markaya özel "otomatik başlatma" ekranını açmayı dener; olmazsa uygulama ayarlarını açar. */
    @PluginMethod
    public void otomatikBaslatma(PluginCall call) {
        Context c = getContext();
        String[][] adaylar = {
                {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
                {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
                {"com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"},
                {"com.oplus.safecenter", "com.oplus.safecenter.permission.startup.StartupAppListActivity"},
                {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
                {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
                {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"},
                {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
                {"com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"},
                {"com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
                {"com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"},
                {"com.asus.mobilemanager", "com.asus.mobilemanager.MainActivity"},
        };
        String marka = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase();
        boolean acildi = false;
        if (!marka.contains("samsung") && !marka.contains("google")) {
            for (String[] a : adaylar) {
                try {
                    Intent i = new Intent();
                    i.setComponent(new android.content.ComponentName(a[0], a[1]));
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    c.startActivity(i);
                    acildi = true;
                    break;
                } catch (Exception ignored) {}
            }
        }
        if (!acildi) uygulamaAyarlari(c);
        JSObject r = new JSObject();
        r.put("ozel", acildi);
        call.resolve(r);
    }

    @PluginMethod
    public void uygulamaAyarlariAc(PluginCall call) {
        uygulamaAyarlari(getContext());
        call.resolve();
    }

    @PluginMethod
    public void pilAyari(PluginCall call) {
        Context c = getContext();
        try {
            Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
        } catch (Exception e) {
            uygulamaAyarlari(c);
        }
        call.resolve();
    }

    @PluginMethod
    public void alarmAyari(PluginCall call) {
        Context c = getContext();
        if (Build.VERSION.SDK_INT >= 31) {
            try {
                Intent i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + c.getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(i);
            } catch (Exception e) {
                uygulamaAyarlari(c);
            }
        }
        call.resolve();
    }

    private static void uygulamaAyarlari(Context c) {
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + c.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
        } catch (Exception ignored) {}
    }

    @PluginMethod
    public void alarmKur(PluginCall call) {
        String soruId = call.getString("soruId");
        Double zaman = call.getDouble("zaman");
        if (soruId == null || zaman == null) {
            call.reject("soruId ve zaman gerekli");
            return;
        }
        Ortak.alarmKur(getContext(), soruId, call.getString("kisiId", ""), call.getString("ad", ""), zaman.longValue());
        call.resolve();
    }

    @PluginMethod
    public void alarmIptal(PluginCall call) {
        String soruId = call.getString("soruId");
        if (soruId != null) Ortak.alarmIptal(getContext(), soruId);
        call.resolve();
    }

    @PluginMethod
    public void telefonlar(PluginCall call) {
        JSObject l = call.getObject("liste", new JSObject());
        Ortak.tercih(getContext()).edit().putString("telefonlar", l.toString()).apply();
        call.resolve();
    }

    @PluginMethod
    public void soruBildirimiKapat(PluginCall call) {
        String soruId = call.getString("soruId");
        if (soruId != null) Ortak.kapat(getContext(), Ortak.noSoru(soruId));
        call.resolve();
    }

    @PluginMethod
    public void cevapSirala(PluginCall call) {
        String soruId = call.getString("soruId");
        String cevap = call.getString("cevap");
        if (soruId == null || cevap == null) {
            call.reject("soruId ve cevap gerekli");
            return;
        }
        JSONObject konum = null;
        try {
            JSObject k = call.getObject("konum");
            if (k != null && k.has("lat")) konum = k;
        } catch (Exception ignored) {}
        Ortak.cevapSirala(getContext(), soruId, cevap, call.getString("ad", ""), konum);
        Ortak.kapat(getContext(), Ortak.noSoru(soruId));
        call.resolve();
    }

    @PluginMethod
    public void olaylariAl(PluginCall call) {
        List<JSONObject> l = Ortak.olaylariBosalt(getContext());
        JSArray dizi = new JSArray();
        for (JSONObject o : l) dizi.put(o);
        JSObject r = new JSObject();
        r.put("olaylar", dizi);
        call.resolve(r);
    }
}
