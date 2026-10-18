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

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Google Play ödemeleri.
 *  - iyiyim_tam     : İyiyim Tam (tek seferlik, kalıcı) → onaylanır (acknowledge), tüketilmez
 *  - iyiyim_hediye  : Hediye İyiyim Tam (tekrar alınabilir) → sunucu kabul edince tüketilir
 *  - destek_149     : Geliştiriciyi destekle (tekrar alınabilir) → hemen tüketilir
 */
final class Destek {
    static final String URUN = "destek_149";
    static final String TAM = "iyiyim_tam";
    static final String HEDIYE = "iyiyim_hediye";
    static final String HEDIYE_IND = "iyiyim_hediye_49";

    interface Sonuc {
        /** durum: "tamam" | "iptal" | "bekliyor" | "hata"; token: satın alma jetonu; mesaj: açıklama */
        void bitti(String durum, String token, String mesaj);
    }

    interface Fiyatlar {
        void geldi(JSONObject fiyatlar, String mesaj);
    }

    private static BillingClient istemci;
    private static Sonuc bekleyen;
    private static String bekleyenUrun;

    private static Context baglam;

    private static synchronized BillingClient istemci(Context c) {
        if (baglam == null) baglam = c.getApplicationContext();
        if (istemci == null) {
            istemci = BillingClient.newBuilder(c.getApplicationContext())
                    .setListener(Destek::satinAlmaGuncellendi)
                    .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                    .build();
        }
        return istemci;
    }

    private interface Hata {
        void oldu(String mesaj);
    }

    private static void baglan(Context c, Runnable hazir, Hata hata) {
        BillingClient b = istemci(c);
        if (b.isReady()) {
            hazir.run();
            return;
        }
        b.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult r) {
                if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) hazir.run();
                else hata.oldu(aciklama(r));
            }

            @Override
            public void onBillingServiceDisconnected() { }
        });
    }

    private interface UrunlerSonuc {
        void geldi(List<ProductDetails> urunler);
    }

    private static void urunleriAl(Context c, List<String> kimlikler, UrunlerSonuc s, Hata hata) {
        baglan(c, () -> {
            List<QueryProductDetailsParams.Product> l = new ArrayList<>();
            for (String k : kimlikler) {
                l.add(QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(k).setProductType(BillingClient.ProductType.INAPP).build());
            }
            istemci(c).queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(l).build(), (r, sonucListe) -> {
                List<ProductDetails> liste = sonucListe != null ? sonucListe.getProductDetailsList() : null;
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK || liste == null || liste.isEmpty()) {
                    hata.oldu(Ortak.s(c, R.string.b_urun_yok));
                    return;
                }
                s.geldi(liste);
            });
        }, hata);
    }

    static String fiyat(ProductDetails u) {
        ProductDetails.OneTimePurchaseOfferDetails d = u.getOneTimePurchaseOfferDetails();
        return d != null ? d.getFormattedPrice() : "";
    }

    /** Ürün fiyatlarını Play'den okur; yarım kalmış destek satın almalarını tamamlar. */
    static void fiyatlar(Context c, List<String> kimlikler, Fiyatlar sonuc) {
        urunleriAl(c, kimlikler, liste -> {
            yarimKalanlariTamamla(c);
            JSONObject o = new JSONObject();
            try {
                for (ProductDetails u : liste) o.put(u.getProductId(), fiyat(u));
            } catch (Exception ignored) {}
            sonuc.geldi(o, "");
        }, m -> sonuc.geldi(new JSONObject(), m));
    }

    static void satinAl(Activity a, String urun, String hesap, Sonuc sonuc) {
        java.util.List<String> l = new ArrayList<>();
        l.add(urun);
        urunleriAl(a, l, liste -> a.runOnUiThread(() -> {
            bekleyen = sonuc;
            bekleyenUrun = urun;
            BillingFlowParams.Builder pb = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(java.util.Collections.singletonList(
                            BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(liste.get(0)).build()));
            // Satın almayı bu hesaba bağla: sunucu, başkasının jetonunun kullanılmasını engeller
            if (hesap != null && !hesap.isEmpty() && hesap.length() <= 64) pb.setObfuscatedAccountId(hesap);
            BillingFlowParams p = pb.build();
            BillingResult r = istemci(a).launchBillingFlow(a, p);
            if (r.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
                bekleyen = null;
                // Zaten alınmış: elimizdeki satın almayı bul ve onu döndür
                sahipOlunanlar(a, o -> {
                    String token = o.optString(urun, "");
                    if (token.isEmpty()) {
                        JSONArray h = o.optJSONArray(urun + "_liste");
                        if (h != null && h.length() > 0) token = h.optString(0);
                    }
                    sonuc.bitti(token.isEmpty() ? "hata" : "tamam", token, token.isEmpty() ? Ortak.s(a, R.string.b_zaten) : "");
                });
            } else if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                bekleyen = null;
                sonuc.bitti("hata", "", aciklama(r));
            }
        }), m -> sonuc.bitti("hata", "", m));
    }

    private static void satinAlmaGuncellendi(BillingResult r, List<Purchase> liste) {
        Sonuc s = bekleyen;
        String urun = bekleyenUrun;
        bekleyen = null;
        int kod = r.getResponseCode();
        if (kod == BillingClient.BillingResponseCode.OK && liste != null) {
            String token = "";
            boolean bekliyor = false;
            for (Purchase p : liste) {
                if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                    if (p.getProducts().contains(URUN)) tuket(p.getPurchaseToken());
                    else if (p.getProducts().contains(TAM)) onayla(p);
                    // iyiyim_hediye: sunucu kabul edince tüketilir
                    if (urun == null || p.getProducts().contains(urun)) token = p.getPurchaseToken();
                } else if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) {
                    bekliyor = true;
                }
            }
            if (s != null) {
                if (!token.isEmpty()) s.bitti("tamam", token, "");
                else if (bekliyor) s.bitti("bekliyor", "", Ortak.s(baglam, R.string.b_bekliyor));
                else s.bitti("hata", "", Ortak.s(baglam, R.string.b_tamamlanmadi));
            }
        } else if (kod == BillingClient.BillingResponseCode.USER_CANCELED) {
            if (s != null) s.bitti("iptal", "", "");
        } else if (s != null) {
            s.bitti("hata", "", aciklama(r));
        }
    }

    private static void onayla(Purchase p) {
        if (istemci == null || p.isAcknowledged()) return;
        istemci.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(p.getPurchaseToken()).build(), x -> { });
    }

    static void tuket(String token) {
        if (istemci == null || token == null || token.isEmpty()) return;
        istemci.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(token).build(), (r, t) -> { });
    }

    interface Sahip {
        void geldi(JSONObject o);
    }

    /** Hesabın elindeki satın almalar: {"iyiyim_tam": token, "iyiyim_hediye_liste": [token, ...]} */
    static void sahipOlunanlar(Context c, Sahip sonuc) {
        baglan(c, () -> istemci(c).queryPurchasesAsync(QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP).build(), (r, liste) -> {
            JSONObject o = new JSONObject();
            JSONArray hediyeler = new JSONArray();
            JSONObject hediyeUrun = new JSONObject();
            try {
                if (liste != null) {
                    for (Purchase p : liste) {
                        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
                        if (p.getProducts().contains(TAM)) {
                            onayla(p);
                            o.put(TAM, p.getPurchaseToken());
                        } else if (p.getProducts().contains(HEDIYE) || p.getProducts().contains(HEDIYE_IND)) {
                            hediyeler.put(p.getPurchaseToken());
                            hediyeUrun.put(p.getPurchaseToken(), p.getProducts().contains(HEDIYE_IND) ? HEDIYE_IND : HEDIYE);
                        } else if (p.getProducts().contains(URUN)) {
                            tuket(p.getPurchaseToken());
                        }
                    }
                }
                o.put(HEDIYE + "_liste", hediyeler);
                o.put("hediye_urun", hediyeUrun);
            } catch (Exception ignored) {}
            sonuc.geldi(o);
        }), m -> sonuc.geldi(new JSONObject()));
    }

    private static void yarimKalanlariTamamla(Context c) {
        sahipOlunanlar(c, o -> { });
    }

    private static String aciklama(BillingResult r) {
        switch (r.getResponseCode()) {
            case BillingClient.BillingResponseCode.BILLING_UNAVAILABLE:
                return Ortak.s(baglam, R.string.b_kullanilamaz);
            case BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE:
            case BillingClient.BillingResponseCode.SERVICE_DISCONNECTED:
            case BillingClient.BillingResponseCode.NETWORK_ERROR:
                return Ortak.s(baglam, R.string.b_ulasilamadi);
            case BillingClient.BillingResponseCode.ITEM_UNAVAILABLE:
            case BillingClient.BillingResponseCode.DEVELOPER_ERROR:
                return Ortak.s(baglam, R.string.b_play_surum);
            default:
                return Ortak.s(baglam, R.string.b_baslatilamadi, r.getResponseCode());
        }
    }
}
