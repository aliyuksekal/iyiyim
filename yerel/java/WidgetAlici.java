package com.matali.iyiyim;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Widget düğmelerinin yayınları. Manifest'te dışa kapalıdır (exported=false):
 * yalnızca widget'ın kendi PendingIntent'leri tetikleyebilir, başka bir uygulama
 * kullanıcının adına "İyiyim" ya da "Yardım" gönderemez.
 */
public class WidgetAlici extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        IyiyimWidget.eylem(this, c, i);
    }
}
