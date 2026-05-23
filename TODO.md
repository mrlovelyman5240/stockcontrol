# Stockcontrol — Yapılacaklar Yol Haritası

> Bu dosya oturumlar arası ilerlemeyi takip eder. Her görev tamamlanınca `[ ]` → `[x]` yapılır ve commit'lenir. Bir sonraki oturum bu dosyayı okuyarak nerede kaldığımızı bilir.

**Son güncelleme:** 2026-05-23
**Audit raporları:**
- `three-brain-out/2026-05-20-full-audit/`
- `three-brain-out/2026-05-23-base-stock-review/` (Codex review of base-stock ch3+ch4)
- `three-brain-out/2026-05-23-base-stock-rereview/` (Codex re-review of ch5-ch8)

---

## FAZ 0 — 🔴 KRİTİK GÜVENLİK (production'a çıkmadan önce zorunlu)

Para ve hesap kaybına yol açabilecek bug'lar. Sıra önemli.

- [x] **0.1** Public `/auth/register` endpoint'inden `boss` rolünü engelle (`backend/server.py:242`). Sadece `driver` ve `service` register edebilsin, `boss` ayrı bir admin akışıyla yaratılsın.
- [x] **0.2** Startup'taki otomatik `admin/admin123` hesabı oluşturma kodunu kaldır (`backend/server.py:1197-1210`). İlk kurulumda env'den okunan tek seferlik setup token'ı ile yapılacak.
- [x] **0.3** Public `/seed` endpoint'ini kaldır veya `if not PROD` ile koru (`backend/server.py:1115-1124`).
- [x] **0.4** **Sipariş toplamını backend'de yeniden hesapla.** Client'tan gelen `total` ve `price` field'larına güvenme. Item'ları DB'den çek, fiyatı oradan al, total'i backend hesapla (`backend/server.py:519`, `OrderItem` modeli `server.py:101`).
- [x] **0.5** **Stok düşmeyi atomic yap.** Mongo'da koşullu `$inc` kullan (`stock >= quantity` filtresiyle) veya transaction kullan (`backend/server.py:481-505`). Race condition'ı kapat.
- [x] **0.6** `free_gift` ürünleri için stok düşme mantığını ekle veya server-side enforce et (`backend/server.py:482`). Şu an client `is_free_gift=true` yollarsa stok düşmüyor.
- [x] **0.7** `/orders/{id}` PUT endpoint'inde yetki kontrolü ekle (`backend/server.py:530`). Driver sadece kendi siparişini, sadece belirli status transition'larına geçebilsin. Genel update boss/service'e kısıtlansın.
- [x] **0.8** `delete_order` içinde status kontrolü ekle (`backend/server.py:624`). Cancelled order silinirken stok ikinci kez restore edilmesin.
- [x] **0.9** Negatif değer validation ekle: `PaymentCreate.amount` ve `DriverHoursCreate.hours` için Pydantic'te `gt=0` (`backend/server.py:150, 164`). Inventory `price` ve `stock` için de `ge=0`.

---

## FAZ 1 — 🟡 ÖNEMLİ GÜVENLİK

- [x] **1.1** `JWT_SECRET` hardcoded default'unu kaldır (`backend/server.py:25`). Env yoksa app başlamasın (fail-fast).
- [x] **1.2** CORS `*` yerine env'den `CORS_ORIGINS` oku, virgülle ayrılmış domain listesini parse et (`backend/server.py:1180`).
- [x] **1.3** Login endpoint'ine rate limit ekle (`slowapi` paketiyle). Dakikada 5 deneme civarı (`backend/server.py:276`).
- [x] **1.4** Status/role/order_type/payment_method için Enum kullan, serbest string yerine (`backend/server.py:117, 126, 169`).
- [x] **1.5** Mongo'ya unique index ekle: `users.username`, `orders.id`, `inventory.id`, `payments.id`, `driver_hours(driver_id, date)`.

---

## FAZ 2 — REFACTOR (DRY, dosya bölme)

- [x] **2.1** `backend/server.py` (1187 satır) → `backend/routers/` altında `auth.py`, `users.py`, `orders.py`, `inventory.py`, `payments.py`, `settings.py` olarak böl. FastAPI `APIRouter` kullan. (+ driver_hours, audit, stats; server.py 1247→105 satır)
- [x] **2.2** Frontend: `pages/boss/Inventory.js` + `pages/service/Inventory.js` → tek `pages/shared/Inventory.js` (role prop ile).
- [x] **2.3** Frontend: `pages/boss/Staff.js` + `pages/service/Staff.js` → tek `pages/shared/Staff.js`.
- [x] **2.4** `pages/service/NewOrder.js` (390 satır) → alt componentlere böl: `ProductSearch`, `Cart`, `GiftSelector`, `DriverSelect`. (+ `VariantDialog` extra; NewOrder 731→315 satır)
- [x] **2.5** "Change password" formunu (Settings + Driver Profile + Service Profile'da tekrar eden) tek `ChangePasswordForm` component'ine taşı.
- [x] **2.6** `BottomNav.js` içindeki rol bazlı navigasyon mantığını merkezi config'e taşı (`config/navigation.js`).
- [x] **2.7** Eski/güncel olmayan testleri sil: `backend/tests/test_new_features_v5.py` içindeki `TestPhotoUploadAPI` ve `test_delivery_api.py:409` `per_package_rate`.

---

## FAZ 3 — UI / UX İYİLEŞTİRMELERİ

Mevcut görünümü modernleştirme ve tutarlılık.

- [ ] **3.1** Renk paleti & spacing standardı: Tailwind config'e custom color tokens ekle, semantik isimlerle (primary/success/warning/danger). Tüm sayfalarda aynı padding/gap (`p-4`, `gap-3` vs.) kullan.
- [ ] **3.2** Dashboard kartlarını yeniden tasarla: ikon + büyük metrik + trend göstergesi (örn. bugünkü sipariş sayısı + dünden % değişim).
- [ ] **3.3** Loading skeleton'ları ekle (şu an sadece spinner var). `Skeleton` component'i zaten mevcut, sayfalarda kullanılsın.
- [ ] **3.4** Empty state'leri görsel hale getir: illüstrasyon/ikon + açıklama + CTA buton ("İlk siparişini oluştur").
- [ ] **3.5** Toast'ların pozisyonunu mobile için top yerine bottom-center yap (mobile thumb zone). Sonner config.
- [ ] **3.6** Form UX: inline validation hatası göster (kırmızı border + altında küçük metin), submit'te toast yerine.
- [ ] **3.7** Tablolardan `Card`-based listelere geç (mobile için). Boss Inventory ve Orders sayfalarında.
- [ ] **3.8** Bottom nav active state'ini iyileştir: ikon scale + renk + üstte küçük indicator.
- [ ] **3.9** Dark mode geçiş animasyonu yumuşat, sistem teması default seç.
- [ ] **3.10** Login sayfasını yeniden tasarla: gradient bg, daha iyi tipografi, brand logo alanı.

---

## FAZ 4 — PWA (mobile-friendly)

`vite-plugin-pwa` + `workbox-window` ile tek seferde 4.1-4.5 kapatıldı. Manifest ve service worker artık build-time generate ediliyor (`dist/manifest.webmanifest`, `dist/sw.js`, hashed `workbox-*.js`).

- [x] **4.1** Manifest: `id`/`scope`/`start_url` eklendi, mevcut name/icons/theme/shortcuts korundu. Plugin tarafından `manifest.webmanifest` olarak üretiliyor.
- [x] **4.2** Workbox build-time hash + `cleanupOutdatedCaches: true` — her deploy eski cache versiyonlarını siler.
- [x] **4.3** `/assets/*` (Vite output) → `CacheFirst` runtime caching (immutable hashed filenames).
- [x] **4.4** `/api/*` → `NetworkFirst` with 5s timeout, fallback to cache (offline'da son cache'lenmiş response).
- [x] **4.5** `PWAUpdatePrompt` component'i `useRegisterSW` hook'u ile "Yeni sürüm hazır → Yenile/Sonra" prompt'u gösteriyor; offline-ready bildirimi de aynı surface'te.
- [ ] **4.6** Auth token'ı `localStorage` → `HttpOnly cookie`'ye taşı (XSS koruması). Backend `Set-Cookie` döndürsün, frontend `credentials: 'include'` kullansın. (Ayrı chunk — backend + frontend coordinated change.)
- [x] **4.7** `apple-touch-icon.png` zaten mevcut, manifest'te ve index.html'de link var. (iOS farklı device boyutları için optional splash variants ilerleyen aşamada eklenebilir.)
- [ ] **4.8** Lighthouse PWA skoru 90+: tarayıcıda Mixy tarafından test edilecek (CI'a lighthouse-ci eklenmesi ayrı bir görev).

---

## FAZ 5 — DEPLOYMENT

### Backend → Railway
- [x] **5.1** `backend/` içine `Procfile` veya `railway.json` ekle: start command `uvicorn server:app --host 0.0.0.0 --port $PORT`.
- [x] **5.2** Railway dashboard'da env değişkenlerini set et: `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `CORS_ORIGINS`.
- [x] **5.3** MongoDB Atlas (veya Railway Mongo plugin) bağlantısını doğrula.
- [x] **5.4** Health check endpoint ekle (`/health` → `{"status": "ok"}`). (zaten mevcut: `/api/health`)

### Frontend → Vercel
- [x] **5.5** Vercel projesi oluştur, root directory `frontend`.
- [x] **5.6** Build command `npm run build`, output directory `build`. (Vite migration sonrası `dist` oldu)
- [x] **5.7** Env değişkeni: `REACT_APP_BACKEND_URL=https://<railway-url>`.
- [ ] **5.8** Custom domain bağla (varsa). (atlandı — sabit Vercel URL yeterli)
- [x] **5.9** Preview deployment'lar için CORS'ta Vercel preview pattern'ini kapsa (`https://*.vercel.app`). (production URL `stockcontrol-delta.vercel.app` CORS'ta sabit)

---

## FAZ 7 — BASE-STOCK MODELİ (✅ DONE 2026-05-23)

Eski model: her `ItemVariant`'ın kendi `stock` field'ı var, sipariş direkt variant'tan düşürür.
Yeni model: tek `product.stock` (base stock). Variant'ta sadece `units_per` (default 1). Sipariş `qty * units_per` kadar base'den düşürür. `OrderItem.units_per` snapshot'ı iptal/silme'de doğru restore için kullanılır.

- [x] **7.1** Backend: `ItemVariant.units_per` + `OrderItem.units_per` snapshot eklendi. Sipariş atomik `$inc` ile base stock düşürür, rollback prior deduction (ch1, commit `1365196`).
- [x] **7.2** Frontend Inventory form: base stock üstte, variant'lar `units_per` ile (ch2, commit `edec8b0`).
- [x] **7.3** Frontend NewOrder akışı + child component'lar (ProductSearch/VariantDialog/GiftSelector/parent): tüm `variant.stock` referansları kaldırıldı, `floor(stock/units_per)` kullanıldı (ch3, commit `db87999`).
- [x] **7.4** Test suite yeniden yazıldı: eski `test_variant_stock_tracking.py` silindi, yerine `test_base_stock_tracking.py` (356 satır, snapshot integrity testi dahil) — ch4, commit `0647bc6`.
- [x] **7.5** 🔴 CRITICAL atomic state transitions: `cancel_order` / `complete_order` / `delete_order` artık `update_one({id, status: pending})` ile koşullu — eşzamanlı double-restore race kapandı. `OrderUpdate`'ten `status` kaldırıldı, generic PUT artık stock bypass edemez (ch5, commit `b410e50`).
- [x] **7.6** 🟠 HIGH cart-aware base stock: `baseConsumedForProduct` + `remainingBaseStock` helper'ları sepet + free gift'i ortak havuza karşı sayar. Add/+1/gift handler'ları base'e karşı gate'lenir. Client'tan gönderilen `total` field'ı kaldırıldı — backend zaten yeniden hesaplıyor (ch6, commit `5dad724`).
- [x] **7.7** 🟡 MEDIUM data integrity: `_resolve_units_per` strict (null=1 default, geri kalan int>=1 değilse 400). `ItemVariant.stock` model'den kaldırıldı (`extra="ignore"` eski DB docs için tolerant). Frontend `variantUnitsPer` invalid'de `null` döner, dialog'lar "Data error" göster (ch7, commit `2eb0026`).
- [x] **7.8** 9 yeni test: delete snapshot integrity, multi-line shared pool + partial rollback, exact boundary, free-gift deduct/restore, units_per corruption (ch8, commit `18b9926`).
- [x] **7.9** 🟠 Re-review fix: cancel/delete'te `_resolve_units_per` artık state transition'dan ÖNCE çalışır (partial transition bug'u kapandı). Bool reddi eklendi (`int(True)` masking riski). `updateQuantity` `unitsPer===null` guard. Free gift delete testi + non-variant multi-line testi eklendi (ch9, commit `7a99e10`).

**Notlar:**
- Codex review: 15 bulgu yakalandı, ch5-8'de kapatıldı. Re-review: 2 HIGH (ch5+ch7 etkileşimi) + minor concerns, ch9'da kapatıldı.
- Audit dosyaları: `three-brain-out/2026-05-23-base-stock-*/`.

---

## FAZ 6 — TEST (✅ DONE 2026-05-23)

- [x] **6.1** Frontend için `vitest` + `@testing-library/react` + `jsdom` kuruldu, smoke test'ler yazıldı: `AuthContext` (provider scope + initial state), `Login` (render + empty-submit guard + credential pass-through), `NewOrder` (data load + base-stock display).
- [x] **6.2** Backend için `test_security_fixes.py` eklendi: public register'da boss rolü engellenir, sipariş `total`/`price` client'tan ignore edilir, generic PUT status'ü değiştiremez, Payment/DriverHours/Inventory numeric validator'ları. (Önceki base-stock testleri ch4/ch8'de zaten yenilenmişti.)
- [x] **6.3** CI workflow eklendi (`.github/workflows/test.yml`): frontend `npm ci` + `npm test` + `npm run build`; backend `pip install` + `compileall` + `pytest --collect-only`. Tam integration test job'u (live MongoDB + uvicorn) sonraki adım olarak not edildi.

---

## NOTLAR

- Her görev sonrası: `git add . && git commit -m "[faz.no] kısa açıklama" && git push`
- Aynı oturumda birden fazla küçük görev yapılırsa tek commit'te toplanabilir.
- Görev sırası önemli: önce FAZ 0 bitmeden production deploy YOK.
- UI değişiklikleri (FAZ 3) güvenlik fix'leriyle paralel ilerleyebilir.
