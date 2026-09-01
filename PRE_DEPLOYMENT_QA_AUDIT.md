# Pre-Deployment QA & Architecture Audit

**Proje:** Optik Form Okuyucu  
**İlk denetim tarihi:** 21 Temmuz 2026  
**İlk karar:** **NO-GO**  
**Kod düzeltmeleri sonrası karar:** **CONDITIONAL GO** — kod tabanındaki doğrulanmış bulgular kapatıldı; aşağıdaki production ortam girdileri sağlanmadan mağaza/canlı dağıtım yapılmamalıdır.

## Kapsam ve yöntem

Ana uygulama kodu önce dosya dosya incelendi. Daha sonra yalnızca yayınlanabilirliği doğrulamak için bağımlılık, Firebase, Expo ve backend deployment dosyaları denetlendi. Düzeltmelerden sonra frontend/backend lint, unit/integration test, bağımlılık audit’i, Expo Doctor ve üç platform bundle kontrolleri çalıştırıldı.

İncelenen yüzey:

- React Native/Expo uygulama girişi ve ekranları
- Navigation ve Firebase Authentication yaşam döngüsü
- Firestore okuma/yazma/silme akışları ve Security Rules
- Form seçme, upload, timeout ve API response sözleşmesi
- Flask, Pillow ve OpenCV tabanlı OMR backend’i
- PDF paylaşma/yazdırma ve tarama geçmişi
- Bağımlılıklar, temiz kurulum, lint, test ve production bundle

---

# 1. Kritik Hatalar ve Buglar

## ✅ C-01 — Temiz kurulumdaki `expo-print` bundle hatası kapatıldı

**Eski sorun:** `screens/Answer_key.js` doğrudan `expo-print` import ediyor, fakat paket `package.json` içinde bulunmuyordu. Temiz kurulum Metro bundle’ını durdurabiliyordu.

**Uygulanan çözüm:** `expo-print` doğrudan ve Expo SDK ile uyumlu bağımlılık olarak eklendi (`package.json:27`). Paket kilidi temiz kurulumla yenilendi. PDF işlemleri hata/loading yönetimiyle `screens/AnswerResultScreen.js` ve `screens/SavedFormsScreen.js` içinde kullanılıyor.

## ✅ C-02 — Yerel/açık HTTP API adresleri kaldırıldı

**Eski sorun:** İki ekran iki farklı `10.10.x.x` adresini açık HTTP ile kullanıyordu.

**Uygulanan çözüm:** Tek adres `EXPO_PUBLIC_API_URL` üzerinden okunuyor (`src/config/environment.js:8`). Production ortamında HTTPS zorunlu; eksik, hatalı ve `.invalid` placeholder adresleri kullanıcı isteği gönderilmeden reddediliyor. Testler HTTP ve placeholder reddini doğruluyor.

```js
const response = await fetch(`${getApiBaseUrl()}/scan`, options);
```

Gerçek production domain’i kaynak koda gömülmeyecek; EAS/CI environment üzerinden sağlanacaktır.

## ✅ C-03 — Backend hata JSON’unun başarılı sonuç sayılması engellendi

**Eski sorun:** İstemci yalnızca JSON parse ediyor, `response.ok` kontrol etmeden sonuç ekranına gidiyordu. `400/500` yanıtı sıfır skor gibi görüntülenebiliyordu.

**Uygulanan çözüm:** `src/services/scanApi.js:58` HTTP status kontrolü yapıyor; başarılı response ayrıca `src/domain/scanResult.js` ile 100 soru, geçerli A–E seçenekleri ve skor toplamı açısından doğrulanıyor.

```js
if (!response.ok) throw new ScanApiError(...);
return assertScanResult(payload);
```

## ✅ C-04 — Eksik/yanlış optik formun sessizce skorlanması engellendi

**Eski sorun:** Dörtten az cevap alanı bulunan görüntüler, kalan soruları boş bırakarak yine HTTP 200 üretiyordu.

**Uygulanan çözüm:** `backend/omr.py:59` tam dört, ayrı ve benzer boyutlu cevap bölgesi bekliyor. Cevap anahtarındaki okunamayan sorular `INVALID_ANSWER_KEY` hatasıyla reddediliyor (`backend/omr.py:161`). Kullanıcı düzeltilebilir OMR hatalarında `422` alıyor.

## ✅ C-05 — RGB/BGR renk kanalı hatası düzeltildi

Pillow’dan gelen RGB dizi artık doğru dönüşümle işleniyor (`backend/omr.py:83`):

```python
gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
```

## ✅ C-06 — Görüntü API’si güvenli request sınırına alındı

`backend/app.py` içinde:

- Firebase ID token zorunlu ve revoke kontrolü aktif (`backend/app.py:38`, `backend/app.py:117`).
- Token içinde UID bulunması zorunlu.
- `/scan` kullanıcı/IP seviyesinde dakikada 10 istekle sınırlı.
- Production ortamında paylaşımlı Redis rate-limit storage zorunlu (`backend/app.py:95`).
- Request 16 MB, görüntü 12 megapiksel ile sınırlandırıldı (`backend/app.py:25`, `backend/app.py:84`).
- JPEG/PNG/WEBP dışındaki içerikler ve Pillow decompression bomb uyarıları reddediliyor.
- Teknik exception metni kullanıcıya dönmüyor; güvenli kod, mesaj ve request ID dönüyor (`backend/app.py:162`).
- `Cache-Control: no-store` ve `X-Content-Type-Options: nosniff` response header’ları eklendi.

## ✅ C-07 — Uyumsuz ikinci tarama ekranı kaldırıldı

`screens/OpticScanScreen.js` ve eski `code/` altındaki Streamlit/Flask prototip kaynakları ürün akışından kaldırıldı. Tek tarama sözleşmesi `src/services/scanApi.js` ve `backend/app.py` arasında tanımlandı. Eski/generated `__pycache__` dosyaları `.gitignore` kapsamındadır ve production build context’ine girmez.

## ✅ C-08 — Analiz yarış durumu, çift tıklama ve sonsuz bekleme kapatıldı

`screens/OpticUploadScreen.js` işlem boyunca butonu kilitliyor, request sequence ile eski yanıtı yok sayıyor ve servisteki `AbortController` 30 saniyelik timeout uyguluyor (`src/services/scanApi.js:46`).

## ✅ C-09 — Sonuç ekranı eksik navigation parametresinde çökmüyor

`screens/AnswerResultScreen.js:26`, parametreyi render öncesi doğruluyor. Geçersiz state/deep link durumunda güvenli hata ekranı gösteriliyor.

## Sonsuz döngü ve listener sonucu

**Sorun bulunmadı.** State bağımlı sonsuz `useEffect` döngüsü yok. Auth listener unsubscribe fonksiyonu döndürüyor; focus tabanlı async işlemler active flag ile unmount sonrası state güncellemesini önlüyor.

---

# 2. Performans ve Optimizasyon

## ✅ P-01 — Upload yükü azaltıldı

Image picker kalitesi `0.8` yapıldı, EXIF istenmiyor ve gerçek `fileName`/`mimeType` korunuyor. Backend görüntüyü NumPy dönüşümünden önce en fazla `2400×2400` boyutuna indiriyor.

## ✅ P-02 — Sonuç tablosu sanallaştırıldı

100 satır iç içe ScrollView yerine `FlatList` ile çiziliyor (`screens/AnswerResultScreen.js:110`). `initialNumToRender` ve `windowSize` ayarları bulunuyor.

## ✅ P-03 — Tarama geçmişi sayfalandı

`screens/ScanHistoryScreen.js:27` sayfa boyutunu 25 olarak tanımlıyor. İlk sorgu `limit`, sonraki sayfalar `startAfter` kullanıyor (`screens/ScanHistoryScreen.js:87`). Ekran focus olduğunda ilk sayfa yeniden doğrulanıyor.

## ✅ P-04 — API response küçültüldü

Tekrarlı DataFrame, marked matrix ve detail kopyaları kaldırıldı. Response yalnızca:

- `score`
- 100 elemanlı `answers`
- küçük `diagnostics`

alanlarını içeriyor (`backend/omr.py:179`).

## ✅ P-05 — Upload/sonuç state tekrarı kaldırıldı

Upload ekranı artık büyük sonucu kendi state’inde tutmuyor ve kopya sonuç tablosu render etmiyor; doğrulanmış sonucu doğrudan `AnswerResult` ekranına iletiyor.

## ✅ P-06 — UI, ağ ve domain sınırları ayrıldı

- Environment: `src/config/environment.js`
- API/timeout/auth header: `src/services/scanApi.js`
- Response domain validation: `src/domain/scanResult.js`
- Firebase hata çevirisi: `src/utils/firebaseErrors.js`
- OMR domain: `backend/omr.py`
- HTTP/security sınırı: `backend/app.py`

Bu proje Expo/React Native olduğu için Next.js Server/Client Component sınırı uygulanmaz; eşdeğer UI/service ayrımı yukarıdaki katmanlarla sağlandı.

---

# 3. Temizlik ve Teknik Borç

## ✅ T-01 — Kullanılmayan kod ve paketler temizlendi

- Kullanılmayan import/state/stiller kaldırıldı.
- Compat ve native Firebase paketlerinin birlikte bulunması kaldırıldı; modular Firebase JS SDK kullanılıyor.
- Gerçek auth persistence için AsyncStorage yalnızca `firebase.js` içinde kullanılıyor.
- Kullanılmayan checkbox, pager, alternatif Firebase ve prototip bağımlılıkları kaldırıldı.
- `npm run lint` kullanılmayan import ve `console.*` kullanımını hata kabul ediyor.

## ✅ T-02 — Prototip ve dead code temizlendi

Streamlit prototipi ve API ile uyumsuz `OpticScanScreen` kaldırıldı. Python cache, Expo cache, dist, coverage ve secret dosyaları `.gitignore`/`.dockerignore` ile ürün artefaktlarından çıkarıldı.

## ✅ T-03 — Tekrarlı kod azaltıldı

Form seçimi ortak `pickImage`, görsel alanı `ImageSelector`, Firebase hata dönüşümü ortak helper, API upload ortak servis, sonuç şeması ortak domain validator üzerinden çalışıyor.

## ✅ T-04 — Mock ve iç sistem ayrıntıları kaldırıldı

`example@example.com`, dahili `Mobil_Uygulama\assets\forms` metni, yorum satırındaki eski navigation ve `console.log/error` kalıntıları kaldırıldı.

## ✅ T-05 — İsimlendirme normalleştirildi

- `Answer_key.js` → `AnswerResultScreen.js`
- `signin.js` → `SignInScreen.js`
- `signup.js` → `SignUpScreen.js`
- Navigation route adları `AnswerResult`, `ScanHistory`, `About` olarak sadeleştirildi.

---

# 4. Veri Bütünlüğü ve Hata Yönetimi

## ✅ V-01 — Public ve authenticated stack ayrıldı

`App.js:25` ve `App.js:37` iki ayrı navigator tanımlıyor. `App.js:54` Firebase auth state’i dinliyor; kullanıcı yokken hesap, geçmiş, upload ve sonuç ekranları mount edilmiyor.

## ✅ V-02 — Kalıcı auth state gerçek persistence ile sağlandı

Çalışmayan “Oturumu açık tut” checkbox ve e-posta cache’i kaldırıldı. Native platformlarda Firebase Auth, UID’den bağımsız profil verisi saklamadan AsyncStorage persistence kullanıyor (`firebase.js:34`). Web kendi Firebase browser persistence katmanını kullanıyor.

## ✅ V-03 — Hesaplar arası kullanıcı adı sızıntısı kapatıldı

Global `userName` AsyncStorage anahtarı tamamen kaldırıldı. Profil adı yalnızca oturumdaki UID’ye ait Firestore dokümanından okunuyor.

## ✅ V-04 — Hesap güncellemeleri atomik kullanıcı aksiyonlarına ayrıldı

Ad, e-posta ve parola ayrı buton ve loading durumlarına sahip (`screens/AccountSettings.js:68`, `:92`, `:121`). E-posta/parola güncellemesi mevcut parola ile reauthentication yapıyor (`screens/AccountSettings.js:62`). Böylece tek genel “başarısız” mesaj altında kısmi işlem saklanmıyor.

## ✅ V-05 — Firestore ownership ve alan doğrulaması eklendi

`firestore.rules`:

- Kullanıcı yalnızca kendi profilini okuyup yazabilir.
- `scanHistory.userId`, `request.auth.uid` ile eşit olmak zorundadır.
- Alan kümesi, ad uzunluğu, integer skorlar ve toplam 100 kural seviyesinde doğrulanır.
- Geçmiş yalnızca sahibi tarafından okunabilir/silinebilir; update kapalıdır (`firestore.rules:44`).

Gerekli `userId + createdAt` composite index `firestore.indexes.json` içindedir.

## ✅ V-06 — Ham backend/SDK hataları kullanıcıya gösterilmiyor

Backend exception ayrıntısını logluyor, kullanıcıya `SCAN_FAILED` ve request ID dönüyor. İstemcide Firebase hataları kontrollü mesaj tablosundan geçiyor. Giriş ekranı kullanıcı var/yok bilgisini ayırt eden mesaj üretmiyor.

## ✅ V-07 — Girdiler ve sonuç şeması doğrulanıyor

- E-postalar trim/lowercase ve format kontrolünden geçiyor.
- Kayıt/profil adı 1–80 karakter.
- Parola uygulama politikası minimum 8 karakter.
- Görüntü formatı, compressed boyut ve piksel boyutu backend’de doğrulanıyor.
- Sonuç 100 cevap, A–E seçenekleri ve toplam 100 skor gerektiriyor.
- PDF’e yazılan metin HTML escape işleminden geçiyor (`screens/AnswerResultScreen.js:221`).

## ✅ V-08 — Geçmiş hata ve silme akışı düzeltildi

Boş veri ile network/index hatası ayrı mesajlar gösteriyor. Silme işlemi kayıt adını içeren destructive confirmation istiyor (`screens/ScanHistoryScreen.js:100`) ve başarısızlık sessizce yutulmuyor.

## ✅ V-09 — Paylaş/Yazdır davranışları platforma uygun hale getirildi

- Mobilde sonuç PDF oluşturulup paylaşım paneline gönderiliyor.
- Web’de sonuç HTML’i tarayıcı yazdırma paneline gönderiliyor.
- Boş optik form Android/iOS’ta gerçek `Print.printAsync({uri})` ile yazdırılıyor (`screens/SavedFormsScreen.js:45`).
- Web’de PDF yeni sekmede açılıyor.
- Paylaşım desteği olmayan platformlarda güvenli geri bildirim var.

## ✅ V-10 — Firebase istemci yapılandırması ortam değişkenlerine taşındı

`firebase.js` içinde anahtar/proje değerleri hardcode edilmiyor. Firebase istemci API key’inin gizli olmadığı, fakat Rules, App Check ve API key restriction gerektiği README’de açıklandı.

---

# 5. Geliştirme ve Ekleme Sonuçları

## ✅ Backend production hazırlığı

- `requirements.txt`
- Python 3.12 tabanlı `Dockerfile`
- `backend/wsgi.py` Gunicorn girişi
- Non-root container kullanıcısı
- Health endpoint
- Request ID ve güvenli structured event alanları
- CORS allow-list
- Redis destekli production rate limit

Flask geliştirme sunucusu production komutu olarak kullanılmıyor.

## ✅ OMR confidence ve regresyon testi

Her soru için dominance tabanlı confidence hesaplanıyor; API ortalama confidence ve contour sayısını döndürüyor. `backend/tests/test_omr.py` deterministik sentetik golden template’in 100 işareti doğru okuduğunu ve boş görüntünün skorlanmak yerine reddedildiğini test ediyor.

## ✅ Otomatik kalite kapısı

`package.json:15` içindeki `npm run check` aşağıdaki kontrolleri zincirliyor:

1. Expo/ESLint
2. Jest
3. Ruff
4. Pytest
5. Expo Doctor
6. Production dependency audit

## Ölçeklenebilirlik notu

Mevcut senkron API, worker/thread ve rate limit ile kontrollü düşük/orta trafik için uygundur. Uzun süreli veya toplu sınav işleme ihtiyacı doğarsa bir sonraki mimari adım object storage + queue + background worker + job status endpoint olmalıdır. Bu, mevcut tek-form senkron ürün gereksinimi için zorunlu bir bug fix değildir.

---

# 6. Dosya Bazlı Son Durum

| Dosya | Son durum |
|---|---|
| `App.js` | Auth state tabanlı public/authenticated stack; listener cleanup mevcut |
| `firebase.js` | Modular SDK, native persistent auth, environment config |
| `screens/AboutScreen.js` | Responsive logo ve ScrollView |
| `screens/AccountSettings.js` | Ayrı işlemler, reauth, validation, safe errors |
| `screens/AnswerResultScreen.js` | Guard, FlatList, güvenli save/PDF/print |
| `screens/ForgotPassword.js` | Normalize email ve enumeration-safe sonuç |
| `screens/Intro.js` | Yalnız ileri swipe, responsive layout |
| `screens/Onboarding.js` | Yalnız geri swipe; korumalı stack’e guest geçiş yok |
| `screens/OpticUploadScreen.js` | Tek API servisi, loading, timeout, MIME koruma |
| `screens/ProfileMenuScreen.js` | UID’ye bağlı Firestore profili; global cache yok |
| `screens/SavedFormsScreen.js` | Gerçek print ve doğru “Paylaş” aksiyonu |
| `screens/ScanHistoryScreen.js` | Pagination, focus refresh, delete confirmation |
| `screens/SignInScreen.js` | Merkezi auth state ve güvenli hata mesajları |
| `screens/SignUpScreen.js` | Normalize email, 8 karakter politika, auth stack geçişi |
| `src/services/scanApi.js` | Token, timeout, HTTP status ve schema kontrolü |
| `backend/app.py` | Auth, rate limit, upload validation, safe errors |
| `backend/omr.py` | RGB, contour/key validation, confidence, compact result |
| `firestore.rules` | Ownership ve schema bütünlüğü |
| `package.json` | Expo 57 uyumu, doğrudan bağımlılıklar, kalite scriptleri |

---

# 7. Son Doğrulama Sonuçları

| Kontrol | Sonuç |
|---|---:|
| `npm run lint` | ✅ Başarılı |
| Jest frontend testleri | ✅ 7/7 |
| `python -m ruff check backend` | ✅ Başarılı |
| Pytest backend testleri | ✅ 8/8 |
| Expo Doctor | ✅ 20/20 |
| `npm audit --omit=dev` | ✅ 0 açık |
| Android production export | ✅ Başarılı |
| iOS production export | ✅ Başarılı |
| Web production export | ✅ Başarılı |
| Dockerfile build | 🟡 Docker CLI var, yerel Docker daemon kapalı olduğu için image build çalıştırılamadı |

## Doğrulanan güvenlik regresyonları

- Token olmadan `/scan`: `401 UNAUTHENTICATED`
- Eksik dosya: `422 MISSING_IMAGE`
- İç exception: generic `500 SCAN_FAILED`; exception metni response’a sızmıyor
- Boş OMR görüntüsü: skor yerine validation error
- Geçersiz cevap anahtarı: `INVALID_ANSWER_KEY`
- Geçersiz frontend skor/option/HTTP URL/placeholder URL: validator tarafından reddediliyor

---

# 8. Production Ortamında Sağlanması Gereken Dış Girdiler

Bunlar kaynak kod sorunu değildir; deploy edilen altyapıya ait zorunlu değerlerdir:

1. `.env`/EAS içinde gerçek `EXPO_PUBLIC_API_URL=https://...` değeri verilmeli. Repodaki `.invalid` değer güvenli ve bilinçli placeholder’dır.
2. Backend’e `GOOGLE_APPLICATION_CREDENTIALS` veya workload identity sağlanmalı.
3. Production `RATELIMIT_STORAGE_URI` Redis gibi ortak storage göstermeli.
4. Web hedefi kullanılacaksa `ALLOWED_ORIGINS` gerçek origin ile tanımlanmalı.
5. `firestore.rules` ve `firestore.indexes.json` Firebase projesine deploy edilmeli.
6. Firebase App Check Android/iOS/web provider’ları Console’da etkinleştirilmeli.
7. Gerçek, anonimleştirilmiş ve etiketli form veri seti üzerinde ürün doğruluk kabul eşiği ölçülmeli.
8. CI/CD ortamında Docker daemon ile image build ve container smoke testi tekrarlanmalı.

Bu sekiz dış girdi tamamlandığında kod tabanı açısından doğrulanan bir yayın engeli kalmamaktadır.

---

# 9. Nihai Rapor–Kod Mutabakatı

21 Temmuz 2026 tarihinde düzeltmeler ve rapor tamamlandıktan sonra bu belge yeniden baştan sona okunmuş ve güncel kaynak kodla karşılaştırılmıştır.

- Eski yerel HTTP endpoint, Firebase compat/native çift kullanımı, debug `console.*`, TODO/FIXME/HACK, mock kullanıcı ve kaldırılmış ekran/route kalıntıları ana kaynak dizinlerinde yeniden tarandı; ürün kodunda artık bulunmadı.
- Raporda adı geçen tüm güncel kaynak, test, Rules ve deployment dosyalarının varlığı doğrulandı.
- `npm run check` nihai kez çalıştırıldı ve exit code `0` ile tamamlandı: Jest 7/7, Pytest 8/8, ESLint/Ruff temiz, Expo Doctor 20/20 ve production dependency audit 0 açık.
- Bu belgedeki kapatılmış bulgular ile kodun son durumu arasında çelişki saptanmadı.
- Bölüm 8'deki maddeler secret, gerçek domain, Firebase Console/deploy, Redis, gerçek veri seti ve çalışan container altyapısı gerektirdiğinden kaynak kod içinde güvenli biçimde varsayılmamış; production release gate olarak açık bırakılmıştır.
