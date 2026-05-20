Harika bir başlangıç. İstenen dosyaları analiz edip raporu oluşturmaya başlıyorum.

## Kod Analizi: Envanter/Sipariş Yönetim Uygulaması

### 1. MİMARİ HARİTASI

-   **Backend:**
    -   **Framework:** Python **FastAPI** (`backend/server.py:1`). `uvicorn` ile çalıştırılıyor.
    -   **Veritabanı (DB):** **MongoDB** (NoSQL). `motor` asenkron kütüphanesi kullanılıyor (`backend/server.py:16`).
    -   **Authentication (Auth):** **JWT (JSON Web Tokens)**. Token'lar `HTTPBearer` şeması ile taşınıyor. Şifreler `bcrypt` ile hash'leniyor (`backend/server.py:255`). `JWT_SECRET` bir varsayılan değere sahip, bu güvensizdir (`backend/server.py:21`).
    -   **Endpoint Sayısı:** `backend/server.py` dosyasında `/api` prefix'i altında yaklaşık **35 adet** endpoint bulunmaktadır (auth, users, inventory, orders, payments, stats, vb.).

-   **Frontend:**
    -   **Framework/Kütüphaneler:** **React** (`frontend/package.json`). UI için **shadcn/ui** ve **TailwindCSS** kullanılıyor.
    -   **Routing:** **React Router DOM** (`frontend/src/App.js:1`) ile client-side routing yapılıyor. URL'ler role göre `/boss`, `/driver`, `/service` olarak gruplanmış. `ProtectedRoute` komponenti ile rol bazlı yetkilendirme mevcut (`frontend/src/App.js:40`).
    -   **State Yönetimi:** Temel olarak React'in kendi **Context API**'ı kullanılıyor (`frontend/src/contexts/AuthContext.js`, `frontend/src/contexts/ThemeContext.js`). `design_guidelines.json` dosyasında `zustand` önerilse de `package.json`'da bulunmuyor, yani kullanılmamış.
    -   **Veri Akışı:** `frontend/src/lib/api.js` dosyasında tanımlanan `axios` istemcisi, backend API endpoint'lerine istek atarak veri alışverişi yapıyor. Token, `localStorage`'da saklanıp her isteğe `Authorization` header'ı olarak ekleniyor (`frontend/src/contexts/AuthContext.js:12`).

### 2. EKSİK / ZAYIF NOKTALAR

-   **Production Ready mi?** Hayır.
    -   **CORS Politikası:** Backend, tüm kaynaklardan gelen isteklere izin veriyor (`allow_origins=['*']`), bu üretim için büyük bir güvenlik açığıdır (`backend/server.py:1174`). Belirli frontend domain'leri ile kısıtlanmalıdır.
    -   **Deployment Config:** `uvicorn` doğrudan development için kullanılıyor. Üretim ortamı için Gunicorn gibi bir WSGI sunucusu arkasında birden fazla worker ile çalışacak bir yapı (örneğin `gunicorn -w 4 -k uvicorn.workers.UvicornWorker`) ve Nginx gibi bir reverse proxy yapılandırması eksik.
    -   **Environment Değişkenleri:** `.env` dosyası kullanılıyor ancak bu dosyanın üretim ortamında nasıl yönetileceği (örn. Docker Secrets, Kubernetes ConfigMaps/Secrets, cloud provider secret manager) belirsiz.

-   **Test Kapsamı:** Zayıf.
    -   **Backend:** `backend/tests` altında birkaç test dosyası var ancak bunlar tüm endpoint'leri ve iş mantığını kapsamıyor. Örneğin, `test_new_features_v5.py` dosyasında test edilen fotoğraf yükleme API'ı daha sonra kaldırılmış (`test_ui_cleanup_v6.py`). Bu, testlerin güncel tutulmadığını gösteriyor. 35'ten fazla endpoint varken, testler sadece temel senaryoları kapsıyor.
    -   **Frontend:** Proje yapısında **hiçbir frontend testi** (`*.test.js`, `*.spec.js`) bulunmuyor. UI komponentlerinin, kullanıcı akışlarının ve state mantığının testleri eksik.

-   **Error Handling:** Orta düzeyde.
    -   **Backend:** FastAPI'nin `HTTPException` mekanizması tutarlı bir şekilde kullanılıyor, bu iyi.
    -   **Frontend:** `lib/utils.js` içinde `getApiErrorMessage` adında merkezi bir hata mesajı formatlama fonksiyonu var. Ancak `NewOrder.js` gibi kritik sayfalarda `catch` bloklarında doğrudan `toast.error('Failed to create order')` gibi genel mesajlar kullanılıyor (`frontend/src/pages/service/NewOrder.js:192`). Bu, backend'den gelen detaylı hata mesajlarının kullanıcıya gösterilmesini engeller.

-   **Loading/Empty State'ler:** İyi. Birçok komponentte `Loader2` ve "No items found" gibi boş durum mesajları mevcut (`frontend/src/pages/boss/AuditLog.js:77`, `frontend/src/pages/boss/Inventory.js:207`). `ProtectedRoute` da genel bir yükleme durumuna sahip (`frontend/src/App.js:44`).

-   **Mobile Responsive mi?** Evet. `design_guidelines.json` "Mobile First" ilkesini belirtiyor ve `BottomNav.js` gibi komponentler, TailwindCSS kullanımı ve genel sayfa yapısı mobil uyumlu bir arayüzü işaret ediyor.

### 3. GÜVENLİK

-   **Hardcoded Secret/Key:** Evet.
    -   `backend/server.py:21`: `JWT_SECRET` için `'logiflow-secret-key-2024'` gibi hardcoded bir varsayılan değer var. Bu, acilen environment değişkenine taşınmalı ve değiştirilmelidir.
-   **DB Credentials Yönetimi:** `MONGO_URL`, `.env` dosyasından okunuyor (`backend/server.py:14`). Bu, sırların koddan ayrılması için doğru bir adımdır, ancak `.env` dosyasının kendisinin güvenli bir şekilde yönetilmesi gerekir.
-   **Auth Flow Güvenliği:** Zayıf.
    -   **Token Storage:** JWT, `localStorage` üzerinde saklanıyor (`frontend/src/contexts/AuthContext.js:38`). Bu, XSS (Cross-Site Scripting) saldırılarına karşı zafiyet oluşturur. Token'ların `HttpOnly` cookie'lerde saklanması çok daha güvenlidir.
    -   **Token Geçerlilik Süresi:** Token'lar 24 saat geçerli (`backend/server.py:23`). Bu süre, kullanıcı aktivitesine göre uzayan (sliding session) bir refresh token mekanizması olmadan uzun bir süredir.
-   **Input Validation:** İyi.
    -   **Backend:** Pydantic modelleri (`backend/server.py` içinde `UserCreate`, `OrderCreate` vb.) gelen veriyi otomatik olarak doğruluyor. Ayrıca parola uzunluğu gibi ek doğrulamalar da mevcut (`backend/server.py:408`).
    -   **Frontend:** Gerekli alanların kontrolü yapılıyor (`frontend/src/pages/service/NewOrder.js:180`).
-   **CORS, Rate Limiting, SQL Injection:**
    -   **CORS:** Üretim için güvensiz (`allow_origins=['*']` `backend/server.py:1174`).
    -   **Rate Limiting:** Uygulanmamış. API endpoint'leri brute-force saldırılarına (özellikle login) açık.
    -   **SQL Injection:** MongoDB kullanıldığı için SQL Injection riski yok. Ancak, `motor` kütüphanesi doğru kullanıldığı için NoSQL Injection riski de düşüktür.

### 4. KOD KALİTESİ

-   **DRY (Don't Repeat Yourself) İhlalleri:** Evet.
    -   `frontend/src/pages/boss/Inventory.js` ve `frontend/src/pages/service/Inventory.js` neredeyse tamamen aynı. Bu iki komponent, rol bazlı küçük farklılıkları prop olarak alacak tek bir `Inventory` komponentinde birleştirilebilir.
    -   Aynı durum `frontend/src/pages/boss/Staff.js` ve `frontend/src/pages/service/Staff.js` için de geçerli.
    -   `BossSettings.js` ve `DriverProfile.js` / `ServiceProfile.js` içindeki parola değiştirme form mantığı tekrar ediyor. Bu da merkezi bir `ChangePasswordForm` komponentine taşınabilir.

-   **500+ Satırlık Dosyalar:** Evet.
    -   `backend/server.py`: **1187 satır**. Bu dosya acilen `routers` adlı bir klasöre (örn: `routers/auth.py`, `routers/orders.py`, `routers/users.py`) bölünmelidir. FastAPI'nin `APIRouter`'ları bu iş için tasarlanmıştır. Bu durum, okunabilirliği ve bakımı ciddi şekilde zorlaştırmaktadır.
    -   `frontend/src/pages/service/NewOrder.js`: **390 satır**. Bu komponentin state yönetimi (özellikle hediye ve varyant seçimi) ve render mantığı, daha küçük alt komponentlere (örn: `GiftSelector`, `ProductSearchList`, `CartSummary`) bölünebilir.

-   **3 Rol Arası Tutarsızlıklar:**
    -   Boss ve Customer Service rolleri için `Inventory` ve `Staff` sayfalarının kopyalanması, gelecekteki değişikliklerin iki ayrı yerde yapılmasını gerektirecek ve hatalara yol açacaktır.
    -   `BottomNav.js` içinde rol bazlı navigasyon elemanlarını belirleyen mantık (`getNavItems`), merkezi bir konfigürasyon nesnesinden okunabilir.

-   **Dead Code / Unused Imports:**
    -   `backend/tests/test_new_features_v5.py`: Artık var olmayan fotoğraf yükleme API'ını test ediyor (`TestPhotoUploadAPI`). Bu testler ya kaldırılmalı ya da güncellenmelidir.
    -   `backend/tests/test_delivery_api.py`: `test_update_settings_as_boss` içinde `per_package_rate` güncelleniyor (`line 409`) fakat bu alan `test_delivery_features_v3.py` içinde `per_delivery_rate` ve `per_pickup_rate` olarak ikiye ayrılmış. Bu, eski ve güncel olmayan bir teste işaret ediyor.

### 5. ÖNCELİKLİ ÖNERİLER (Top 10)

1.  **Güvenlik:** Backend'deki varsayılan `JWT_SECRET` değerini derhal kaldırıp environment değişkeninden okuyun. (`backend/server.py:21`)
2.  **Güvenlik:** Backend CORS politikasını `allow_origins=['*']` yerine sadece frontend'in çalışacağı domaine izin verecek şekilde güncelleyin. (`backend/server.py:1174`)
3.  **Refactor:** `backend/server.py` dosyasını `APIRouter` kullanarak `routers/auth.py`, `routers/orders.py` gibi daha küçük, yönetilebilir modüllere bölün.
4.  **Güvenlik:** Frontend'de JWT'yi `localStorage` yerine `HttpOnly` cookie'lerde saklama yöntemine geçin. Bu, XSS riskini büyük ölçüde azaltır. (`frontend/src/contexts/AuthContext.js`)
5.  **Kod Kalitesi:** Yinelenen `Inventory` (`boss` ve `service` için) ve `Staff` sayfalarını, rolü bir prop olarak alan tek bir komponentte birleştirin. (`frontend/src/pages/boss/Inventory.js`, `frontend/src/pages/service/Inventory.js`)
6.  **Test:** Frontend için `react-testing-library` kurulumu yapın ve en azından `Login`, `NewOrder` ve `AuthContext` için temel birim ve entegrasyon testleri yazın.
7.  **PWA Hazırlığı:** `service-worker.js` ve `manifest.json` dosyaları mevcut. Çevrimdışı temel sayfa sunumu ve "Ana Ekrana Ekle" özelliği için `service-worker.js` içine temel caching stratejileri (örn. cache-first for assets) ekleyin.
8.  **Deployment:** Üretim ortamı için Gunicorn gibi bir WSGI sunucusu ve Nginx (reverse proxy olarak) içeren bir deployment script'i veya Dockerfile hazırlayın.
9.  **Güvenlik:** API'ye, özellikle `/auth/login` endpoint'i için, `slowapi` gibi bir kütüphane ile rate limiting ekleyin.
10. **Kod Kalitesi:** `frontend/src/pages/service/NewOrder.js` komponentini state mantığını ve JSX'i daha küçük, yeniden kullanılabilir alt komponentlere (örn. `ProductSearch`, `Cart`, `GiftSelector`) ayırarak refactor edin.

