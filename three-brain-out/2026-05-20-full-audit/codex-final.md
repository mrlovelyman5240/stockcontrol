/stockcontrol/backend/server.py:1115), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:1124).

4. **Sipariş toplamı client’tan güveniliyor.** Backend fiyatı/stok item’ı DB’den okuyup total hesaplamıyor; `total=order_data.total`: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:519). Frontend hesaplıyor: 
[NewOrder.js](C:/Users/mixy/stockcontrol/frontend/src/pages/service/NewOrder.js:219), [NewOrder.js](C:/Users/mixy/stockcontrol/frontend/src/pages/service/NewOrder.js:262).

5. **Ürün adı, fiyatı, free gift bayrağı client’tan güveniliyor.** `OrderItem` içinde `name`, `price`, `is_free_gift` doğrudan kabul ediliyor: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:101). Free gift stoktan düşülmüyor: 
[backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:482).

6. **Stok race condition var.** Önce stok kontrolü, sonra ayrı `$inc` ile düşme yapılıyor: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:481), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:505). Eşzamanlı iki sipariş stoğu negatife 
indirebilir.

7. **Driver dahil tüm authenticated kullanıcılar genel order update yapabilir.** `/orders/{id}` sadece `get_current_user`; driver kendi siparişi olmayan order’ın status/driver bilgilerini değiştirebilir: 
[backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:530), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:531).

8. **Delete inventory’yi yanlış geri yükleyebilir.** `delete_order` status kontrolü yapmadan her siparişi silip stok restore ediyor; cancelled order silinirse stok ikinci kez geri eklenir: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:624), 
[backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:630), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:644).

9. **Ödeme ve saat girişlerinde negatif değer validation yok.** Driver negatif deposit gönderebilir: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:150), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:686). Negatif çalışma saati 
girilebilir: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:164), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:758).

10. **Status/order_type enum değil.** `status`, `order_type`, `payment_method` serbest string: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:117), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:126), 
[backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:169).

## En Acil 5 Fix

1. Public `/auth/register` ve `/seed` kapatılmalı; boss creation sadece existing boss/admin flow veya one-time setup token ile yapılmalı.
2. Startup default `admin/admin123` kaldırılmalı; prod deploy secret zorunlu olmalı.
3. Sipariş backend’de yeniden fiyatlandırılmalı: item DB’den çekilmeli, total server hesaplamalı, free gift/BOGO kuralları server’da enforce edilmeli.
4. Stok düşme atomic yapılmalı: Mongo transaction veya condition’lı `$inc` (`stock >= quantity`) ve variant array update sonucu kontrol edilmeli.
5. `/orders/{id}` yetkilendirme düzeltilmeli; driver sadece kendi order’ını belirli transition ile complete edebilmeli, generic update boss/CS ile sınırlanmalı.

## PWA Geçişi İçin

- Auth token localStorage’dan HttpOnly Secure SameSite cookie’ye taşınmalı.
- API cache edilmemeli veya açık strateji belirlenmeli; offline order queue olacaksa conflict/stock reconciliation tasarlanmalı.
- SW versiyonlama, cache busting, update prompt ve offline fallback eklenmeli.
- Manifest ikonları/scope/start_url doğrulanmalı; index.html kayıt var: [index.html](C:/Users/mixy/stockcontrol/frontend/public/index.html:40).
- Kritik ekranlar için skeleton/offline state eklenmeli; network yokken “sipariş oluşturuldu” gibi yanıltıcı başarı gösterilmemeli.

## Vercel + Railway Deployment

1. Railway backend: `MONGO_URL`, `DB_NAME`, güçlü `JWT_SECRET`, `CORS_ORIGINS=https://<vercel-domain>` set et.
2. Railway start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`, working dir `backend`.
3. Backend’ten default admin/seed kaldırmadan prod’a çıkma.
4. Vercel frontend: root `frontend`, build `npm run build`, output `build`.
5. Vercel env: `REACT_APP_BACKEND_URL=https://<railway-backend-domain>`.
6. CORS’u sadece Vercel prod/preview domainlerine aç; `allow_credentials=True` ile `*` kullanma.
7. Mongo indexes ekle: `users.username unique`, `orders.id`, `inventory.id`, `payments.id`, `driver_hours(driver_id,date)` unique.
tokens used
40,543
## Gemini Bulgularının Doğrulaması

**Doğru:**
- `JWT_SECRET` insecure default kullanıyor: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:25).
- CORS production için riskli default ile açılıyor: `CORS_ORIGINS` yoksa `*`: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:1180).
- JWT `localStorage`’da tutuluyor: [AuthContext.js](C:/Users/mixy/stockcontrol/frontend/src/contexts/AuthContext.js:10), [AuthContext.js](C:/Users/mixy/stockcontrol/frontend/src/contexts/AuthContext.js:57).
- Login rate limit yok: login endpoint düz bcrypt check yapıyor: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:276).
- Frontend test yok: `frontend` altında `*.test.js` / `*.spec.js` bulunmadı.
- Eski test iddiası doğru: foto endpoint testleri hâlâ var: [test_new_features_v5.py](C:/Users/mixy/stockcontrol/backend/tests/test_new_features_v5.py:331), kaldırıldığını test eden ayrı dosya da var: [test_ui_cleanup_v6.py](C:/Users/mixy/stockcontrol/backend/tests/test_ui_cleanup_v6.py:88).
- Backend tek dosyada aşırı büyük; router ayrımı gerekli.

**Yanlış / abartılı:**
- “Input validation iyi” yanlış. Pydantic tip kontrolü var ama business validation yok: negatif fiyat/stok/saat/ödeme kabul edilebilir: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:71), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:150), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:161).
- “Production için Gunicorn WSGI” ifadesi teknik olarak hatalı. FastAPI ASGI app; Gunicorn kullanılacaksa `uvicorn.workers.UvicornWorker`, Railway’de çoğu durumda direkt `uvicorn` yeterli.
- Endpoint sayısı yaklaşık değil, kodda 33 route var.
- “PWA hazır” abartılı. Manifest ve SW var ama offline auth/data stratejisi yok; SW network-first cache yapıyor ve API tutarlılığı ele alınmamış: [service-worker.js](C:/Users/mixy/stockcontrol/frontend/public/service-worker.js:20).

## Gemini’nin Kaçırdığı Kritik Bulgular

1. **Herkes boss hesabı oluşturabilir.** `/auth/register` public ve role sadece whitelist kontrolü yapıyor; `boss` rolüyle kayıt engellenmiyor: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:242), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:251).

2. **Varsayılan admin production’da otomatik yaratılıyor.** `admin/admin123` startup’ta yoksa oluşturuluyor ve loglanıyor: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:1197), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:1205), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:1210).

3. **Seed endpoint public ve default credential basıyor.** `/seed` auth’suz; `boss123`, `driver123` kullanıcıları oluşturuyor: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:1115), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:1124).

4. **Sipariş toplamı client’tan güveniliyor.** Backend fiyatı/stok item’ı DB’den okuyup total hesaplamıyor; `total=order_data.total`: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:519). Frontend hesaplıyor: [NewOrder.js](C:/Users/mixy/stockcontrol/frontend/src/pages/service/NewOrder.js:219), [NewOrder.js](C:/Users/mixy/stockcontrol/frontend/src/pages/service/NewOrder.js:262).

5. **Ürün adı, fiyatı, free gift bayrağı client’tan güveniliyor.** `OrderItem` içinde `name`, `price`, `is_free_gift` doğrudan kabul ediliyor: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:101). Free gift stoktan düşülmüyor: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:482).

6. **Stok race condition var.** Önce stok kontrolü, sonra ayrı `$inc` ile düşme yapılıyor: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:481), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:505). Eşzamanlı iki sipariş stoğu negatife indirebilir.

7. **Driver dahil tüm authenticated kullanıcılar genel order update yapabilir.** `/orders/{id}` sadece `get_current_user`; driver kendi siparişi olmayan order’ın status/driver bilgilerini değiştirebilir: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:530), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:531).

8. **Delete inventory’yi yanlış geri yükleyebilir.** `delete_order` status kontrolü yapmadan her siparişi silip stok restore ediyor; cancelled order silinirse stok ikinci kez geri eklenir: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:624), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:630), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:644).

9. **Ödeme ve saat girişlerinde negatif değer validation yok.** Driver negatif deposit gönderebilir: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:150), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:686). Negatif çalışma saati girilebilir: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:164), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:758).

10. **Status/order_type enum değil.** `status`, `order_type`, `payment_method` serbest string: [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:117), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:126), [backend/server.py](C:/Users/mixy/stockcontrol/backend/server.py:169).

## En Acil 5 Fix

1. Public `/auth/register` ve `/seed` kapatılmalı; boss creation sadece existing boss/admin flow veya one-time setup token ile yapılmalı.
2. Startup default `admin/admin123` kaldırılmalı; prod deploy secret zorunlu olmalı.
3. Sipariş backend’de yeniden fiyatlandırılmalı: item DB’den çekilmeli, total server hesaplamalı, free gift/BOGO kuralları server’da enforce edilmeli.
4. Stok düşme atomic yapılmalı: Mongo transaction veya condition’lı `$inc` (`stock >= quantity`) ve variant array update sonucu kontrol edilmeli.
5. `/orders/{id}` yetkilendirme düzeltilmeli; driver sadece kendi order’ını belirli transition ile complete edebilmeli, generic update boss/CS ile sınırlanmalı.

## PWA Geçişi İçin

- Auth token localStorage’dan HttpOnly Secure SameSite cookie’ye taşınmalı.
- API cache edilmemeli veya açık strateji belirlenmeli; offline order queue olacaksa conflict/stock reconciliation tasarlanmalı.
- SW versiyonlama, cache busting, update prompt ve offline fallback eklenmeli.
- Manifest ikonları/scope/start_url doğrulanmalı; index.html kayıt var: [index.html](C:/Users/mixy/stockcontrol/frontend/public/index.html:40).
- Kritik ekranlar için skeleton/offline state eklenmeli; network yokken “sipariş oluşturuldu” gibi yanıltıcı başarı gösterilmemeli.

## Vercel + Railway Deployment

1. Railway backend: `MONGO_URL`, `DB_NAME`, güçlü `JWT_SECRET`, `CORS_ORIGINS=https://<vercel-domain>` set et.
2. Railway start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`, working dir `backend`.
3. Backend’ten default admin/seed kaldırmadan prod’a çıkma.
4. Vercel frontend: root `frontend`, build `npm run build`, output `build`.
5. Vercel env: `REACT_APP_BACKEND_URL=https://<railway-backend-domain>`.
6. CORS’u sadece Vercel prod/preview domainlerine aç; `allow_credentials=True` ile `*` kullanma.
7. Mongo indexes ekle: `users.username unique`, `orders.id`, `inventory.id`, `payments.id`, `driver_hours(driver_id,date)` unique.

