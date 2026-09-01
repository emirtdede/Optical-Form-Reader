# Pre-Deployment QA & Architecture Audit — V2

**Ürün:** Optik Form Okuyucu 2.1.0  
**Sahip / geliştirici:** Vellium  
**Denetim tarihi:** 22 Temmuz 2026  
**Ana kapsam:** `src/` ve uygulama tarafından servis edilen varlıklar  
**Hedef:** Vercel üzerinde statik PWA; Firebase, API ve sunucu tarafı form saklama yok

## Yönetici özeti

Kod tabanı dosya dosya incelendi; sabit 100 öğrenci formu sınırı kaldırıldı ve çok sayıda kaynağın cihaz kapasitesine göre güvenli biçimde işlenmesi için mimari yenilendi. Uygulama hâlâ yalnız Vellium'un 100 soruluk, A–E seçenekli standart optik şablonunu okur; kaldırılan sınır soru sayısı değil, tek değerlendirmedeki öğrenci formu sayısıdır.

Uygulanan ana değişiklikler:

- Öğrenci formu adedinde sabit uygulama sınırı yoktur.
- JPG, PNG, WebP, doğrudan PDF ve görüntü içeren ZIP kabul edilir. PDF'nin her sayfası bir formdur.
- Kaynaklar doğal alfabetik sıraya konur ve kullanıcı tarafından seçilen part boyutuna bölünür.
- İçerik sayısı, `hardwareConcurrency` ve varsa `deviceMemory` kullanılarak part/worker önerisi üretilir.
- Kullanıcı öneriyi uygulayabilir, uyguladıktan sonra değiştirebilir veya tamamen kendi ayarını seçebilir.
- Her form sonucu ayrı IndexedDB checkpoint işleminde saklanır.
- İşlem kesilirse tamamlanan, bekleyen, atlanan ve hatalı kaynakların manifestosu korunur.
- Kaynaklar yeniden seçildiğinde içerik parmak iziyle tamamlanan kayıtlar atlanabilir; kullanıcı isterse yeniden işleyebilir.
- Her part ayrı ZIP, tüm sonuçlar ise part klasörleri ve manifestoyla tek ZIP olarak indirilebilir.
- Eski IndexedDB v1 kayıtları v2 normalize şemaya otomatik taşınır.
- Production build, 16/16 test ve production dependency güvenlik denetimi başarılıdır.

**Production kararı:** Kod tarafında yayın engelleyici açık bulgu yoktur. Vellium'un resmî tüzel kişi unvanı, tebligat adresi ve KVKK başvuru kanalı koddan çıkarılamayan operasyonel/yasal bilgidir; canlı yayından önce hukuk danışmanıyla tamamlanmalıdır.

---

## Önceliklendirilmiş bulgular ve uygulanan çözümler

### Kritik — işlem yarıda kesildiğinde bütün sonuçlar kaybolabiliyordu

**Dosyalar:** `src/pages/ScannerPage.tsx:92-99`, `src/pages/ScannerPage.tsx:434-453`, `src/storage/database.ts:136-148`  
**Eski davranış:** Öğrenci sonuçları yalnız bütün `Promise.all` kuyruğu bittikten sonra tek `ExamSession` olarak yazılıyordu. Sekmenin kapanması, kullanıcı iptali veya worker hatası tamamlanmış formları da kaybettiriyordu.

**Uygulanan çözüm:** Üst veri, öğrenci sonuçları ve iş manifestosu ayrı store'lara ayrıldı. Her başarılı sonuç, sonuç + iş durumu + oturum ilerlemesini aynı IndexedDB transaction'ında yazar.

```ts
export async function checkpointResult(session, result, job) {
  const transaction = database.transaction(
    ['sessionMeta', 'results', 'jobs'],
    'readwrite',
  );
  await transaction.objectStore('sessionMeta').put(meta);
  await transaction.objectStore('results').put(storedResult);
  await transaction.objectStore('jobs').put(job);
  await transaction.done;
}
```

Unmount ve kullanıcı iptali ayrıca oturumu `interrupted` durumuna çevirir. Kaynak dosyalar gizlilik nedeniyle saklanmaz; kullanıcı bunları yeniden seçtiğinde tamamlanan içerikler atlanabilir.

### Kritik — sabit 100 form ve eager ZIP açma ölçeklenmiyordu

**Dosyalar:** `src/domain/sources.ts:52-134`, `src/domain/sources.ts:190-237`, `src/pages/ScannerPage.tsx:136-157`  
**Eski davranış:** `MAX_STUDENT_FILES = 100` ve `MAX_BATCH_TOTAL_BYTES = 500 MB` kullanılıyordu. ZIP içindeki bütün görüntüler seçim sırasında blob/File'a dönüştürülerek belleğe alınıyordu.

**Uygulanan çözüm:** Adet/batch sınırı kaldırıldı. Kuyrukta yalnız kaynak descriptor'ı ve `File` referansı tutulur. ZIP girdisi veya PDF sayfası yalnız iş sırası geldiğinde oluşturulur, OMR sonrası referansı bırakılır. Güvenlik için tek görüntü 20 MB, tek PDF/ZIP 250 MB sınırı korunur.

```ts
if (item.sourceKind === 'zip-image') {
  const archive = await this.getZip(item.sourceFile);
  const blob = await archive.file(item.archiveEntryName)!.async('blob');
  return { file: new File([blob], name), fingerprint: await sha256(blob) };
}
```

### Kritik — yeniden seçim aynı öğrencileri tekrar işleyebilirdi

**Dosyalar:** `src/domain/sources.ts:144-160`, `src/pages/ScannerPage.tsx:359-419`  
**Etki:** Kesintiden sonra tüm sınıf yeniden seçildiğinde kullanıcı hangi dosyayı ayıklayacağını bilmek zorunda kalıyor ve yinelenen öğrenci sonuçları oluşabiliyordu.

**Uygulanan çözüm:** Küçük dosyalarda tam SHA-256, 32 MB üzerindeki container'larda boyut + başlangıç/orta/son örneklerinden SHA-256 içerik parmak izi üretilir. PDF parmak izi belge + sayfa numarasıdır. Varsayılan `skip` modu hem aynı içeriği hem de aynı öğrenci numarasını atlar; `reprocess` modu mevcut sonucu aynı kimlikle yeniler.

```ts
if (settings.duplicateMode === 'skip' && knownFingerprint) {
  await putProcessingJob({ ...job, status: 'skipped' });
  continue;
}
```

### Yüksek — kullanıcı her toplu işlemde uygun worker/part değerini tahmin etmek zorundaydı

**Dosyalar:** `src/domain/processing.ts:20-58`, `src/pages/ScannerPage.tsx:551-559`  
**Etki:** Güçsüz cihazda büyük part/4 worker bellek baskısı; güçlü cihazda gereksiz yavaşlık oluşabilirdi.

**Uygulanan çözüm:** İçerik sayısı ve cihaz kapasitesinden öneri hesaplanır. Düşük kapasiteli cihazda en fazla 25'lik part/2 iş, güçlü cihazda 100'lük part/4 iş önerilir. Kullanıcı onayı olmadan seçim zorlanmaz. Part boyutu veya part sayısından yalnız biri düzenlenir; diğeri türetilerek çelişkili ayar engellenir.

```ts
if (settings.partitionMode === 'count') {
  const partCount = Math.min(total, positiveInteger(settings.partCount));
  return { ...settings, partCount, partSize: Math.ceil(total / partCount) };
}
```

### Yüksek — PDF yükleme akışı yoktu

**Dosya:** `src/domain/sources.ts:30-50`, `src/domain/sources.ts:204-233`, `src/pages/ScannerPage.tsx:539-546`  
**Uygulanan çözüm:** PDF.js worker ile sayfa sayısı okunur; öğrenci PDF'sindeki her sayfa bağımsız kuyruk girdisi olur. Sayfa yalnız sırası geldiğinde 2.2 ölçekli JPEG'e çizilir. Canvas boyutları sıfırlanır ve `page.cleanup()` çağrılır. Cevap anahtarı PDF'sinin tam bir sayfa olması zorunludur.

```ts
try {
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  blob = await canvasToBlob(canvas);
} finally {
  page.cleanup();
  canvas.width = 0;
  canvas.height = 0;
}
```

### Yüksek — eski tek-store IndexedDB büyük oturumlarda bütün kaydı tekrar yazıyordu

**Dosya:** `src/storage/database.ts:49-90`, `src/storage/database.ts:150-158`  
**Uygulanan çözüm:** Şema v2; `sessionMeta`, `results`, `jobs` store'ları ve `by-session` indexleri eklendi. v1 `sessions` verisi ilk erişimde kayıpsız taşınır. Manuel öğrenci düzenlemesi artık bütün oturumu değil yalnız ilgili sonucu günceller.

### Yüksek — kesinti manifestosu JSON yedeğinde kayboluyordu

**Dosyalar:** `src/export/exporters.ts:100-111`, `src/pages/SettingsPage.tsx:54-60`, `src/storage/database.ts:344-351`  
**Uygulanan çözüm:** JSON şeması v2 değerlendirmelerle birlikte işleri de taşır. İçe aktarma v1 geriye uyumluluğunu korur; v2 jobs alanını derin doğrulamadan sonra yalnız var olan session kimliklerine bağlar.

### Orta — sınırsız kayıt doğrudan DOM'a basılırsa sonuç ekranı yavaşlayabilirdi

**Dosyalar:** `src/pages/ScannerPage.tsx:593-604`, `src/pages/ResultsPage.tsx:34-35`, `src/pages/ResultsPage.tsx:181-204`  
**Uygulanan çözüm:** Tarama kuyruğu 200, sonuç ve manifest tabloları 250 satırlık kademeli görünüm kullanır. Kullanıcı sonraki grubu açıkça yükler. Veri ve dışa aktarma kapsamı kesilmez; yalnız DOM düğümü sayısı sınırlandırılır.

### Orta — part çıktıları tek kapsamda ayrıştırılamıyordu

**Dosyalar:** `src/export/exporters.ts:216-249`, `src/pages/ResultsPage.tsx:157-160`  
**Uygulanan çözüm:** ZIP kökünde tüm CSV/JSON/manifest; `partlar/part-XXX` altında her partın özeti, cevap matrisi ve manifestosu üretilir. Tamamlanan partlar işlem sürerken ayrı indirilebilir.

### Düşük — eski Service Worker yeni PDF worker'ı ve uygulama kabuğunu geciktirebilirdi

**Dosya:** `public/service-worker.js:1-42`  
**Uygulanan çözüm:** Cache sürümü `v4`; navigasyon network-first, hash'li statik varlıklar cache-first kalır.

---

## Kritik Hatalar ve Buglar (Bugs & Logic Flaws)

**Sorun bulunmadı.**

Kontrol edilenler:

- React hook cleanup ve worker iptali.
- OpenCV/PDF worker initialization hataları.
- Kuyruk cursor paylaşımı ve partlar arası sıra.
- Her sonuçtan sonra atomik checkpoint.
- `ImageBitmap.close`, `Mat.delete`, `page.cleanup` ve canvas sıfırlama.
- Cevap anahtarında eksik/çift işaret doğrulaması.
- Aynı kaynak/öğrenci için skip ve reprocess davranışı.
- Eski IndexedDB kayıtlarının v2 göçü.

## Performans ve Optimizasyon (Performance)

**Production'ı engelleyen sorun bulunmadı.**

```text
Kaynak seçimi
  -> görüntü / PDF sayfası / ZIP girdisi descriptor'ı
  -> doğal alfabetik sıralama
  -> kullanıcı ayarlı partlar
  -> cihaz önerili 1–4 worker
  -> sıradaki kaynağı tembel materialize et
  -> OpenCV Web Worker analizi
  -> atomik IndexedDB checkpoint
  -> görüntü/PDF/ZIP geçici belleğini bırak
```

- OpenCV ana UI thread'inde çalışmaz.
- PDF.js, JSZip, XLSX ve rapor üreticileri dinamik yüklenir.
- 200/250 satırlık kademeli tablolar büyük DOM'u engeller.
- OpenCV worker yaklaşık 15.52 MB, PDF worker yaklaşık 1.25 MB'dır ve Service Worker cache'ine girer.
- İşleme süresini esas olarak CPU, RAM, form çözünürlüğü, PDF/ZIP boyutu ve worker sayısı etkiler. İnternet yalnız uygulama ve motorun ilk indirilmesini etkiler.

**Düşük öncelikli gelecek optimizasyonu:** Yalnız kullanılan OpenCV modüllerini içeren özel WASM build ilk indirmeyi azaltabilir. Upstream build ve OMR regresyon riski nedeniyle bu sürümde uygulanmadı.

## Temizlik ve Teknik Borç (Code Cleanup)

**Sorun bulunmadı.**

- Runtime Firebase, Firestore, Expo/React Native ve Flask backend bağımlılığı yoktur.
- Production `console.log`, `TODO`, `FIXME`, `HACK`, `@ts-ignore` veya yorum içine alınmış eski blok bulunmadı.
- Arayüz ikonları Lucide SVG; ürün ve Vellium logoları güvenli SVG'dir.
- PDF.js lisansı yasal sayfaya eklendi.
- Ağır dışa aktarma bağımlılıkları ana bundle'a zorla dahil edilmez.

## Veri Bütünlüğü ve Hata Yönetimi

**Sorun bulunmadı.**

- Form standardı 100 soru/A–E/dört adet 25 soruluk panel olarak sabittir.
- Cevap anahtarı PDF'si yalnız tek sayfa kabul edilir.
- Öğrenci numarası önceliği: form baloncukları → dosya adı → inceleme numarası.
- Dosya adları doğal sıralanır; özgün seçim sırası eşitlik bozucu olarak korunur.
- JSON v1/v2 içe aktarma, cevap/puan ilişkisi ve jobs alanı derin doğrulanır.
- CSV/XLSX hücreleri formül enjeksiyonuna karşı nötrlenir; yazdırma HTML'i kaçırılır.
- Form, PDF ve ZIP dosyaları IndexedDB'ye yazılmaz.
- API anahtarı, Firebase config, backend endpoint'i veya uygulama sırrı yoktur.

## Geliştirme ve Ekleme Önerileri (Enhancements)

Production'ı engellemeyen öneriler:

1. İzinli/anonymize gerçek çekimlerden OMR regresyon seti oluşturun; precision/recall eşikleri CI'da ölçülsün.
2. Düşük bellekli Android, iOS Safari ve masaüstünde 100/500/1.000 sayfalık stres matrisi çalıştırın.
3. Şablona sürüm/QR işareti ekleyerek ileride algoritma–şablon uyumunu otomatik doğrulayın.
4. GitHub Actions'a `npm ci && npm run check` branch koruması ekleyin.
5. Playwright ile PDF, kesinti-devam, skip/reprocess ve part ZIP akışlarını kalıcı E2E testine dönüştürün.
6. PWA sınırları ileride yetersiz kalırsa domain/worker kodunu koruyarak Tauri ve Capacitor kabukları değerlendirin.

## Dosya dosya inceleme özeti

| Dosya / alan | İncelenen sorumluluk | Sonuç |
|---|---|---|
| `src/types.ts` | Part, progress, queue, job ve sonuç tipleri | Uygun |
| `src/constants.ts` | Form ve tek-container güvenlik sınırları | Uygun; adet sınırı yok |
| `src/domain/processing.ts` | Cihaz önerisi, part türetme | Testli |
| `src/domain/sources.ts` | Görüntü/PDF/ZIP expansion, lazy materialization, fingerprint | Uygun |
| `src/domain/files.ts` | Başlık ve öğrenci no dosya adı fallback'i | Testli |
| `src/domain/scoring.ts` | 100 soru puan/net/belirsiz mantığı | Testli |
| `src/domain/statistics.ts` | Öğrenci ve soru istatistikleri | Testli |
| `src/storage/database.ts` | v2 normalize IndexedDB, migration, checkpoint, import | Entegrasyon testli |
| `src/context/AppDataContext.tsx` | Yerel kayıt state'i ve tek-sonuç güncelleme | Uygun |
| `src/omr/omr.worker.ts` | OMR ve OpenCV bellek yaşam döngüsü | Uygun |
| `src/omr/workerClient.ts` | 1–4 worker havuzu ve fatal-init kapanışı | Uygun |
| `src/pages/ScannerPage.tsx` | Öneri, queue, part, checkpoint, resume, canlı ZIP | Uygun |
| `src/pages/ResultsPage.tsx` | Sonuç, soru, manifest ve part export | Uygun |
| `src/pages/SettingsPage.tsx` | JSON v2 yedek/restore ve yerel veri yönetimi | Uygun |
| `src/export/exporters.ts` | CSV/XLSX/PDF/JSON/part ZIP/yazdırma | Uygun |
| `src/pages/GuidePage.tsx` | PDF, part ve devam etme rehberi | Güncellendi |
| `src/pages/LegalPage.tsx` | Yerel dosya/PDF akışı ve lisanslar | Teknik akış doğru |
| `src/styles.css` | Tema, responsive, queue/part/manifest UI | Uygun |
| `public/service-worker.js` | Offline cache ve sürüm yenileme | v4, uygun |

## Test ve doğrulama kanıtları

```text
npm run check

TypeScript noEmit       başarılı
Vite production build  başarılı (2082 modül)
Test Files              5 passed (5)
Tests                   16 passed (16)
npm audit --omit=dev    0 vulnerability
```

Build çıktısındaki OpenCV `fs`/`crypto externalized` uyarıları upstream paketin kullanılmayan Node dallarına aittir. OpenCV worker ayrı yaklaşık 15.52 MB bundle olarak üretilir. XLSX paketi dinamik chunk'ta yaklaşık 936.81 KB'dır; ana açılış rotasını bloke etmez.

## Vercel yeterlilik kararı

**Vercel statik barındırma bu mimari için yeterlidir.** Formlar Vercel Function'a veya başka bir sunucuya yüklenmez. Vercel yalnız HTML/CSS/JS, OpenCV/PDF worker, manifest, SVG logo ve form şablonunu sunar. Bu nedenle öğrenci formu sayısı Vercel request-body kotasına bağlı değildir; gerçek sınır kullanıcı cihazının RAM/CPU'su ve tarayıcı depolamasıdır.

## Son kontrol listesi

- [x] Öğrenci formu adet sınırı kaldırıldı.
- [x] 100 soruluk form standardı korundu.
- [x] JPG/PNG/WebP/PDF ve görüntü içeren ZIP desteği eklendi.
- [x] PDF sayfaları tembel biçimde işleniyor.
- [x] İçerik/cihaz bazlı öneri ve kullanıcı onayı eklendi.
- [x] Ayarlar öneriden sonra düzenlenebilir.
- [x] Part boyutu veya part sayısı kullanıcı tarafından seçilebilir.
- [x] Doğal alfabetik sıralama uygulanıyor.
- [x] Her sonuç için IndexedDB checkpoint uygulanıyor.
- [x] Bekleyen/tamamlanan/atlanan/hatalı iş manifestosu saklanıyor.
- [x] Tamamlananı atla ve sıfırdan yeniden işle seçenekleri var.
- [x] Part ZIP ve tüm partları içeren tek ZIP var.
- [x] JSON v2 manifest yedeği ve v1 geri uyumluluğu var.
- [x] Rehber, yasal sayfalar ve lisans listesi güncellendi.
- [x] Build, 16 test ve audit geçti.
- [x] Bu rapor son kod durumuna göre yeniden okundu.
- [ ] Vellium resmî tüzel kişi/adres/KVKK kanalı yetkili kişilerce tamamlanacak.

## Nihai sonuç

Kod tarafında açık kritik, yüksek veya orta öncelikli bulgu bırakılmadı. Uygulama statik Vercel yayınına teknik olarak hazırdır. Kaynak dosyaların saklanmaması bilinçli gizlilik kararıdır; kesinti devamında kullanıcı kaynakları yeniden seçer, ancak checkpoint ve parmak izi sistemi tamamlanan işi korur ve tekrar işlemeyi önler.
