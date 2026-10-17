package com.matali.iyiyim;

import android.app.Activity;
import android.content.Context;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import java.util.Collections;
import java.util.List;

/**
 * "Geliştiriciyi destekle": Google Play üzerinden 149,99 ₺'lik isteğe bağlı destek.
 * Ürün tüketilebilir olduğu için isteyen birden fazla kez destek olabilir.
 * Play Console'da "destek_149" kimlikli, 149,99 TRY fiyatlı bir uygulama içi ürün oluşturulmalı.
 */
final class Destek {
    static final String URUN = "destek_149";

    interface Sonuc {
        /** durum: "tesekkurler" | "iptal" | "bekliyor" | "hata"; mesaj: kullanıcıya gösterilecek açıklama */
        void bitti(String durum, String fiyat, String mesaj);
    }

    private static BillingClient istemci;
    private static Sonuc bekleyen;

    private static synchronized BillingClient istemci(Context c) {
        if (istemci == null) {
            istemci = BillingClient.newBuilder(c.getApplicationContext())
                    .setListener(Destek::satinAlmaGuncellendi)
                    .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                    .build();
        }
        return istemci;
    }

    private static void baglan(Context c, Runnable hazir, Sonuc hata) {
        BillingClient b = istemci(c);
        if (b.isReady()) {
            hazir.run();
            return;
        }
        b.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult r) {
                if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) hazir.run();
                else hata.bitti("hata", "", aciklama(r));
            }

            @Override
            public void onBillingServiceDisconnected() {
                // bir sonraki istekte yeniden bağlanılır
            }
        });
    }

    private static void urunAl(Context c, UrunSonuc s, Sonuc hata) {
        baglan(c, () -> {
            QueryProductDetailsParams p = QueryProductDetailsParams.newBuilder()
                    .setProductList(Collections.singletonList(QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(URUN)
                            .setProductType(BillingClient.ProductType.INAPP)
                            .build()))
                    .build();
            istemci(c).queryProductDetailsAsync(p, (r, liste) -> {
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK || liste == null || liste.isEmpty()) {
                    hata.bitti("hata", "", "Destek seçeneği şu an Play Store'dan alınamadı. Uygulama Play Store'dan kurulduğunda çalışır.");
                    return;
                }
                s.geldi(liste.get(0));
            });
        }, hata);
    }

    private interface UrunSonuc {
        void geldi(ProductDetails urun);
    }

    static String fiyat(ProductDetails u) {
        ProductDetails.OneTimePurchaseOfferDetails d = u.getOneTimePurchaseOfferDetails();
        return d != null ? d.getFormattedPrice() : "";
    }

    /** Fiyatı Play'den okur; yarım kalmış destekleri de tamamlar. */
    static void fiyatAl(Context c, Sonuc sonuc) {
        urunAl(c, u -> {
            yarimKalanlariTamamla(c);
            sonuc.bitti("hazir", fiyat(u), "");
        }, sonuc);
    }

    static void baslat(Activity a, Sonuc sonuc) {
        urunAl(a, u -> a.runOnUiThread(() -> {
            bekleyen = sonuc;
            BillingFlowParams p = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(
                            BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(u).build()))
                    .build();
            BillingResult r = istemci(a).launchBillingFlow(a, p);
            if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                bekleyen = null;
                sonuc.bitti("hata", "", aciklama(r));
            }
        }), sonuc);
    }

    private static void satinAlmaGuncellendi(BillingResult r, List<Purchase> liste) {
        Sonuc s = bekleyen;
        bekleyen = null;
        int kod = r.getResponseCode();
        if (kod == BillingClient.BillingResponseCode.OK && liste != null) {
            boolean tamam = false, bekliyor = false;
            for (Purchase p : liste) {
                if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                    tuket(p);
                    tamam = true;
                } else if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) {
                    bekliyor = true;
                }
            }
            if (s != null) {
                if (tamam) s.bitti("tesekkurler", "", "");
                else if (bekliyor) s.bitti("bekliyor", "", "Ödemen onay bekliyor. Onaylanınca desteğin tamamlanacak.");
                else s.bitti("hata", "", "Ödeme tamamlanmadı.");
            }
        } else if (kod == BillingClient.BillingResponseCode.USER_CANCELED) {
            if (s != null) s.bitti("iptal", "", "");
        } else if (s != null) {
            s.bitti("hata", "", aciklama(r));
        }
    }

    private static void tuket(Purchase p) {
        if (istemci == null) return;
        istemci.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), (r, t) -> {
            if (r.getResponseCode() != BillingClient.BillingResponseCode.OK && !p.isAcknowledged()) {
                istemci.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder()
                        .setPurchaseToken(p.getPurchaseToken()).build(), x -> { });
            }
        });
    }

    private static void yarimKalanlariTamamla(Context c) {
        istemci(c).queryPurchasesAsync(QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP).build(), (r, liste) -> {
            if (liste == null) return;
            for (Purchase p : liste) {
                if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) tuket(p);
            }
        });
    }

    private static String aciklama(BillingResult r) {
        switch (r.getResponseCode()) {
            case BillingClient.BillingResponseCode.BILLING_UNAVAILABLE:
                return "Bu telefonda Google Play ödemesi kullanılamıyor. Play Store'a giriş yaptığından emin ol.";
            case BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE:
            case BillingClient.BillingResponseCode.SERVICE_DISCONNECTED:
            case BillingClient.BillingResponseCode.NETWORK_ERROR:
                return "Google Play'e ulaşılamadı. İnternetini kontrol edip tekrar dene.";
            case BillingClient.BillingResponseCode.ITEM_UNAVAILABLE:
            case BillingClient.BillingResponseCode.DEVELOPER_ERROR:
                return "Destek seçeneği Play Store sürümünde etkin olacak.";
            default:
                return "Ödeme başlatılamadı (" + r.getResponseCode() + ").";
        }
    }
}
