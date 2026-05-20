# Stockcontrol — Yapılacaklar Yol Haritası

> Bu dosya oturumlar arası ilerlemeyi takip eder. Her görev tamamlanınca `[ ]` → `[x]` yapılır ve commit'lenir. Bir sonraki oturum bu dosyayı okuyarak nerede kaldığımızı bilir.

**Son güncelleme:** 2026-05-21
**Audit raporu:** `three-brain-out/2026-05-20-full-audit/`

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

- [ ] **2.1** `backend/server.py` (1187 satır) → `backend/routers/` altında `auth.py`, `users.py`, `orders.py`, `inventory.py`, `payments.py`, `settings.py` olarak böl. FastAPI `APIRouter` kullan.
- [ ] **2.2** Frontend: `pages/boss/Inventory.js` + `pages/service/Inventory.js` → tek `pages/shared/Inventory.js` (role prop ile).
- [ ] **2.3** Frontend: `pages/boss/Staff.js` + `pages/service/Staff.js` → tek `pages/shared/Staff.js`.
- [ ] **2.4** `pages/service/NewOrder.js` (390 satır) → alt componentlere böl: `ProductSearch`, `Cart`, `GiftSelector`, `DriverSelect`.
- [ ] **2.5** "Change password" formunu (Settings + Driver Profile + Service Profile'da tekrar eden) tek `ChangePasswordForm` component'ine taşı.
- [ ] **2.6** `BottomNav.js` içindeki rol bazlı navigasyon mantığını merkezi config'e taşı (`config/navigation.js`).
- [ ] **2.7** Eski/güncel olmayan testleri sil: `backend/tests/test_new_features_v5.py` içindeki `TestPhotoUploadAPI` ve `test_delivery_api.py:409` `per_package_rate`.

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

- [ ] **4.1** `frontend/public/manifest.json`'ı doğrula: name, short_name, theme_color, background_color, ikonlar (192px + 512px), `start_url`, `display: standalone`.
- [ ] **4.2** Service worker'a versiyon stratejisi ekle: build-time hash, eski cache'i sil.
- [ ] **4.3** Static asset'leri cache-first strateji (`/static/*`).
- [ ] **4.4** API çağrıları için network-first + fallback (offline'da "internet yok" ekranı).
- [ ] **4.5** "Yeni sürüm var, yenile" prompt'u ekle.
- [ ] **4.6** Auth token'ı `localStorage` → `HttpOnly cookie`'ye taşı (XSS koruması). Backend `Set-Cookie` döndürsün, frontend `credentials: 'include'` kullansın.
- [ ] **4.7** Splash screen ikonları ekle (iOS için `apple-touch-icon`).
- [ ] **4.8** Lighthouse PWA skoru 90+ olana kadar düzelt.

---

## FAZ 5 — DEPLOYMENT

### Backend → Railway
- [x] **5.1** `backend/` içine `Procfile` veya `railway.json` ekle: start command `uvicorn server:app --host 0.0.0.0 --port $PORT`.
- [ ] **5.2** Railway dashboard'da env değişkenlerini set et: `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `CORS_ORIGINS`.
- [ ] **5.3** MongoDB Atlas (veya Railway Mongo plugin) bağlantısını doğrula.
- [x] **5.4** Health check endpoint ekle (`/health` → `{"status": "ok"}`). (zaten mevcut: `/api/health`)

### Frontend → Vercel
- [ ] **5.5** Vercel projesi oluştur, root directory `frontend`.
- [ ] **5.6** Build command `npm run build`, output directory `build`.
- [ ] **5.7** Env değişkeni: `REACT_APP_BACKEND_URL=https://<railway-url>`.
- [ ] **5.8** Custom domain bağla (varsa).
- [ ] **5.9** Preview deployment'lar için CORS'ta Vercel preview pattern'ini kapsa (`https://*.vercel.app`).

---

## FAZ 6 — TEST

- [ ] **6.1** Frontend için `@testing-library/react` kur, smoke test'ler yaz: `Login`, `AuthContext`, `NewOrder` happy path.
- [ ] **6.2** Backend test'lerini güncelle: kaldırılan endpoint'lerin testlerini sil, yeni güvenlik fix'leri için test ekle (boss register engellenmeli, total backend'de hesaplanmalı, vb.).
- [ ] **6.3** CI ekle (`.github/workflows/test.yml`): push'larda backend + frontend test'leri otomatik çalışsın.

---

## NOTLAR

- Her görev sonrası: `git add . && git commit -m "[faz.no] kısa açıklama" && git push`
- Aynı oturumda birden fazla küçük görev yapılırsa tek commit'te toplanabilir.
- Görev sırası önemli: önce FAZ 0 bitmeden production deploy YOK.
- UI değişiklikleri (FAZ 3) güvenlik fix'leriyle paralel ilerleyebilir.
