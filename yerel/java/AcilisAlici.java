package com.matali.iyiyim;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Telefon yeniden başlayınca ya da uygulama güncellenince bekleyen alarmları geri kurar. */
public class AcilisAlici extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String e = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(e) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(e)
                || "android.intent.action.QUICKBOOT_POWERON".equals(e)) {
            Ortak.alarmlariYenidenKur(context.getApplicationContext());
        }
    }
}
