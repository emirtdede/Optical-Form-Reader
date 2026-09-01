# Yeni Şablon Desteği — Teknik Yol Haritası

**Ürün:** Optik Form Okuyucu  
**Hazırlanma tarihi:** 22 Temmuz 2026  
**Durum:** Gelecek sürüm planı — henüz uygulanmayacak  
**Amaç:** Mevcut 100 soruluk form desteğini bozmadan ileride yeni, Vellium tarafından üretilen optik şablonların güvenli biçimde eklenebilmesi

## 1. Yönetici özeti

Projeye ileride yeni optik şablonlar eklenebilir. Ancak mevcut sisteme yalnızca yeni bir PDF dosyası koymak yeterli değildir. OMR algoritması, puanlama sistemi, veri tipleri ve doğrulamalar şu an mevcut formun geometrisine ve 100 soruluk standardına bağlıdır.

Güvenli genişleme için önerilen yaklaşım:

1. Mevcut form `vellium-100-v1` kimliğiyle sürümlü bir şablon olarak kaydedilir.
2. Sabit OMR değerleri merkezi bir `FormTemplateDefinition` yapısına taşınır.
3. Worker, puanlama, istatistik ve dışa aktarma işlemleri seçilen şablon tanımını kullanır.
4. Formlara QR veya makine tarafından okunabilen bir şablon kimliği eklenir.
5. Yalnız Vellium tarafından üretilen ve regresyon testinden geçirilen şablonlar kataloğa alınır.
6. Eski değerlendirmeler mevcut şablon sürümüne otomatik bağlanır.

Bu çalışma yapılana kadar mevcut uygulama yalnız 100 soruluk, A–E seçenekli ve dört adet 25 soruluk cevap alanına sahip formu desteklemeye devam etmelidir.

## 2. Mevcut mimaride şablona bağlı alanlar

### `src/omr/omr.worker.ts`

Şu değerler mevcut form için sabittir:

- Çalışma görüntüsü: `840 × 1200`
- Dört cevap bölgesi
- Bölüm başına 25 soru
- A–E seçenekleri
- Cevap bölgesi perspektif ölçüleri
- Baloncuk doluluk eşiği
- Öğrenci numarası ızgarasının satır/sütun yapısı
- Öğrenci numarası doluluk eşiği
- Algılanacak cevap bölgesi oranları ve hizalama kuralları

### `src/domain/scoring.ts`

- Soru sayısı `100` olarak sabittir.
- Cevap anahtarı uzunluğu 100 olmak zorundadır.
- Başarı yüzdesi 100 soru üzerinden hesaplanır.

### `src/types.ts`

- `ExamSession.questionCount` yalnızca `100` değerini kabul eder.
- Seçenek tipi A–E union tipine bağlıdır.

### Diğer etkilenebilecek alanlar

- Soru istatistikleri
- Cevap matrisi
- XLSX, CSV, PDF, JSON ve ZIP çıktıları
- Sonuç tabloları
- Rehber ve yasal açıklamalar
- Cevap anahtarı doğrulaması
- IndexedDB yedek şeması
- Form indirme ve şablon seçim arayüzü

## 3. Önerilen şablon kayıt sistemi

Tek bir güvenilir tanım; PDF üretimi, OMR, puanlama, arayüz ve kayıt katmanı tarafından kullanılmalıdır.

```ts
interface FormTemplateDefinition {
  id: string;
  version: number;
  name: string;
  description: string;
  questionCount: number;
  choices: string[];
  sections: Array<{
    questionStart: number;
    questionCount: number;
    rows: number;
    columns: number;
  }>;
  studentNumber: {
    enabled: boolean;
    digitCount: number;
    rows: number;
    columns: number;
  };
  processing: {
    imageWidth: number;
    imageHeight: number;
    answerWarpWidth: number;
    answerWarpHeight: number;
    answerFillThreshold: number;
    multiMarkRatio: number;
    studentFillThreshold: number;
  };
  asset: {
    pdfUrl: string;
    previewSvgUrl?: string;
  };
}
```

Mevcut formun başlangıç tanımı:

```ts
export const VELLIUM_100_V1: FormTemplateDefinition = {
  id: 'vellium-100-v1',
  version: 1,
  name: 'Vellium 100 Soru',
  description: 'Dört adet 25 soruluk cevap bölgesi',
  questionCount: 100,
  choices: ['A', 'B', 'C', 'D', 'E'],
  sections: [
    { questionStart: 1, questionCount: 25, rows: 25, columns: 5 },
    { questionStart: 26, questionCount: 25, rows: 25, columns: 5 },
    { questionStart: 51, questionCount: 25, rows: 25, columns: 5 },
    { questionStart: 76, questionCount: 25, rows: 25, columns: 5 },
  ],
  studentNumber: {
    enabled: true,
    digitCount: 11,
    rows: 10,
    columns: 11,
  },
  processing: {
    imageWidth: 840,
    imageHeight: 1200,
    answerWarpWidth: 720,
    answerWarpHeight: 700,
    answerFillThreshold: 0.18,
    multiMarkRatio: 0.7,
    studentFillThreshold: 0.2,
  },
  asset: {
    pdfUrl: '/assets/forms/Optik_Form.pdf',
  },
};
```

## 4. Şablon kimliği ve otomatik tanıma

Her şablonun fiziksel sayfasında sürümlü bir kimlik bulunmalıdır. Önerilen içerik:

```text
OFOR:vellium-100-v1
```

Tercih sırası:

1. Küçük QR kod
2. Makine tarafından okunabilen köşe/işaret kodu
3. Kullanıcının manuel şablon seçimi

QR veya işaret kodu şu faydaları sağlar:

- Şablon otomatik tanınır.
- Yanlış cevap anahtarıyla değerlendirme engellenir.
- Eski şablon sürümleri desteklenmeye devam eder.
- Kullanıcının yanlış şablon seçme riski azalır.
- Geometri ile algoritma sürümü eşleştirilebilir.

QR içeriğinde öğrenci verisi bulunmamalıdır. Yalnız şablon kimliği ve sürümü yer almalıdır.

## 5. Yeni şablonların fiziksel şartları

Yeni şablonlar aşağıdaki koşulları sağlamalıdır:

- Şablon Vellium tarafından üretilmeli ve uygulamadan indirilebilmelidir.
- A4 baskıda ölçek değiştirilmeden kullanılmalıdır.
- Cevap alanlarının çevresinde belirgin dikdörtgen sınırlar bulunmalıdır.
- Cevap bölgeleri birbirinden yeterince uzak olmalıdır.
- Baloncuklar düşük kaliteli yazıcıda da seçilebilir büyüklükte olmalıdır.
- Baloncukların yatay ve dikey aralıkları düzenli olmalıdır.
- Öğrenci numarası alanı açık ve düzenli bir ızgara kullanmalıdır.
- Cevap alanlarının içinde logo, filigran veya dekoratif çizgi bulunmamalıdır.
- Formun dört köşesi kamera/tarayıcı görüntüsünde belirlenebilir olmalıdır.
- Siyah-beyaz ve renkli yazıcı çıktıları aynı geometriyi korumalıdır.
- Şablon kimliği ve sürümü sayfada bulunmalıdır.
- Her yeni fiziksel geometri için ayrı template sürümü oluşturulmalıdır.

## 6. Destek seviyeleri

### Seviye 1 — Aynı geometri, farklı görsel alanlar

Örnekler:

- Farklı ders başlığı
- Kurum adı alanı
- Sınav adı/tarih alanı
- Logonun cevap bölgeleri dışında değiştirilmesi

Dört adet 25 soruluk alan ve öğrenci numarası ızgarası değişmiyorsa mevcut algoritmada az değişiklik gerekir. Bu en düşük riskli genişlemedir.

### Seviye 2 — Farklı soru sayılı Vellium şablonları

Örnekler:

- 20 soru
- 40 soru
- 50 soru
- 80 soru
- 100 soru

Bu seviyede aşağıdaki yapılar dinamik hale getirilmelidir:

- `questionCount`
- Bölüm sayısı
- Bölüm başına soru sayısı
- Cevap anahtarı doğrulaması
- Başarı yüzdesi
- İstatistik tabloları
- Cevap matrisi
- Dışa aktarma başlıkları
- IndexedDB şeması ve yedek doğrulaması

Serbest soru sayısı yerine önceden hazırlanmış ve test edilmiş şablon kataloğu önerilir.

### Seviye 3 — Kullanıcının getirdiği herhangi bir form

Bu kapsam mevcut ürünün basit bir uzantısı değildir. Ayrı bir form tasarım/editör sistemi gerektirir. Sistem kullanıcının formundaki cevap bölgelerini, seçenek sayısını, öğrenci numarası alanını ve soru sırasını tanımlayabilmelidir.

İlk genişleme aşamasında önerilmez. Güvenilirlik ve bakım maliyeti belirgin biçimde artar.

## 7. Veri modeli ve geriye uyumluluk

Her değerlendirme kaydına şablon bilgisi eklenmelidir:

```ts
interface ExamSession {
  templateId: string;
  templateVersion: number;
  questionCount: number;
  // mevcut alanlar
}
```

Mevcut kayıtlar migration sırasında şu değerlerle tamamlanmalıdır:

```ts
templateId: 'vellium-100-v1'
templateVersion: 1
questionCount: 100
```

Kurallar:

- Yayınlanmış bir şablon tanımının geometrisi sonradan değiştirilmemelidir.
- Değişiklik gerektiğinde `vellium-100-v2` gibi yeni sürüm oluşturulmalıdır.
- Eski template tanımları uygulamadan silinmemelidir.
- Eski değerlendirmeler kendi template sürümleriyle açılabilmelidir.
- JSON yedekleri `templateId` ve `templateVersion` alanlarını taşımalıdır.
- Bilinmeyen template kimlikli yedekler kullanıcıya açıklayıcı hata vermelidir.

## 8. Worker ve işlem protokolü

OMR worker yalnız dosya değil, güvenilir template tanımı veya template kimliği almalıdır:

```ts
worker.postMessage({
  id: task.id,
  file: task.file,
  templateId: 'vellium-100-v1',
});
```

Güvenlik için worker kullanıcı tarafından yüklenen rastgele JSON template tanımlarını doğrudan çalıştırmamalıdır. `templateId`, uygulamanın yerleşik ve doğrulanmış template registry'sinden çözümlenmelidir.

Worker değişiklikleri:

- Görüntü ölçülerini template tanımından alır.
- Beklenen cevap bölgesi sayısını template tanımından alır.
- Her bölümdeki soru/seçenek ızgarasını dinamik hesaplar.
- Doluluk ve çift işaret eşiklerini template sürümüne göre uygular.
- Okunan soru sayısını `template.questionCount` ile doğrular.
- Öğrenci numarası alanı yoksa dosya adı fallback'ini kullanır.

## 9. Arayüz değişiklikleri

Tarama ekranına şu alanlar eklenmelidir:

- Şablon seçici
- Şablon önizlemesi
- “Bu şablonu indir” düğmesi
- Soru sayısı ve seçenek türü özeti
- Otomatik algılanan şablon etiketi
- Cevap anahtarı ile öğrenci formunun aynı şablon olduğuna dair doğrulama
- Desteklenmeyen/yanlış şablon için açıklayıcı hata

Şablon seçimi mevcut part, checkpoint, PDF ve ZIP akışlarıyla birlikte çalışmalıdır.

## 10. Test ve kabul şartları

Her yeni template sürümü için ayrı bir regresyon fixture paketi hazırlanmalıdır:

- Tamamen boş form
- Tam ve doğru cevap anahtarı
- Her seçenek için tek işaret
- Çift işaretler
- Hafif kurşun kalem
- Koyu kurşun/tükenmez işaret
- Silgi izi
- Gölge
- Parlama
- Perspektif bozulması
- Hafif döndürülmüş görüntü
- Tarayıcıdan oluşturulan PDF
- Telefon kamerası görüntüsü
- Siyah-beyaz yazıcı çıktısı
- Düşük çözünürlüklü görüntü
- Kenarı veya köşesi kısmen eksik görüntü
- Yanlış template ile cevap anahtarı eşleştirme denemesi
- Eski template sürümüne ait kayıt/yedek açma

Her template için ölçülmesi gerekenler:

- Soru bazında doğru okuma oranı
- Boş cevabın boş algılanma oranı
- Çift işaret algılama oranı
- Öğrenci numarası doğruluğu
- Hatalı şablonun reddedilme oranı
- Ortalama ve en kötü işlem süresi
- Mobil cihaz tepe RAM kullanımı

Mevcut `0.18` ve `0.2` doluluk eşikleri yeni baloncuk geometrileri için otomatik olarak doğru kabul edilmemelidir. Her template sürümünde yeniden kalibre edilmelidir.

## 11. Önerilen uygulama aşamaları

### Aşama 1 — Registry temeli

- `FormTemplateDefinition` tipini oluştur.
- Yerleşik template registry ekle.
- Mevcut formu `vellium-100-v1` olarak kaydet.
- Mevcut sabitleri registry tanımından okut.
- Mevcut davranışın değişmediğini regresyon testleriyle doğrula.

### Aşama 2 — Veri ve worker dönüşümü

- `ExamSession` içine template kimliği/sürümü ekle.
- IndexedDB migration uygula.
- Worker protokolüne `templateId` ekle.
- Puanlama ve istatistikleri dinamik soru sayısına hazırla.
- JSON yedek/restore şemasını güncelle.

### Aşama 3 — Kullanıcı arayüzü

- Template seçim ve indirme ekranı ekle.
- Tarama ekranında aktif template bilgisini göster.
- Cevap anahtarı/öğrenci formu template uyumluluğunu doğrula.
- Sonuç ve dışa aktarmalarda template adını göster.

### Aşama 4 — İlk yeni template

- İkinci template olarak örneğin 50 soruluk A–E form hazırla.
- Şablon kimliği/QR ekle.
- Fotoğraf ve PDF fixture'larını oluştur.
- Doluluk eşiklerini kalibre et.
- Mobil/masaüstü regresyonlarını tamamla.

### Aşama 5 — Katalog genişletme

- Yalnız testleri geçen template sürümlerini yayınla.
- Eski sürümleri geriye uyumluluk için koru.
- Rehber, yasal sayfalar ve lisans listesini her yeni varlıkta güncelle.

## 12. Hukuki ve lisans koşulları

- Üçüncü taraf bir kurumun şablonu kopyalanmamalıdır.
- Yeni formlar Vellium tarafından özgün olarak tasarlanmalı veya gerekli kullanım izni alınmalıdır.
- Form üzerindeki logo, marka ve yazı tiplerinin kullanım hakları doğrulanmalıdır.
- Kullanılan QR, barkod veya PDF üretim kütüphaneleri lisans sayfasına eklenmelidir.
- Şablon üzerinde öğrenciden yeni kişisel veri alanları istenirse gizlilik/KVKK metinleri güncellenmelidir.
- Kaynak form görüntülerinin yerel işlenmesi ve saklanmaması ilkesi korunmalıdır.

## 13. Mimari karar

Önerilen ürün kapsamı, “herhangi bir optik formu otomatik anlayan sistem” değil; “Vellium tarafından üretilen, sürümlü ve test edilmiş şablon kataloğu” olmalıdır.

Bu yaklaşım:

- Okuma doğruluğunu korur.
- Kullanıcı hatalarını azaltır.
- Yeni şablon eklemeyi öngörülebilir hale getirir.
- Eski değerlendirmelerin açılmasını garanti eder.
- Test ve bakım maliyetini kontrol altında tutar.

## 14. Başlamadan önce kabul edilmesi gereken kararlar

Uygulama zamanı geldiğinde şu kararlar netleştirilmelidir:

1. İlk yeni form kaç soruluk olacak?
2. Seçenekler A–E olarak mı kalacak?
3. Öğrenci numarası yine 11 haneli mi olacak?
4. Şablon kimliği için QR kullanımı kabul edilecek mi?
5. Kullanıcı template'i manuel seçebilecek mi, yoksa otomatik tanıma zorunlu mu olacak?
6. Aynı değerlendirmede farklı template'ler karıştırılabilecek mi? Öneri: karıştırılmamalı.
7. Eski template PDF'leri uygulama paketinde süresiz tutulacak mı? Öneri: evet.

## 15. Sonuç

Yeni şablon desteği teknik olarak mümkündür. En güvenli yol önce mevcut formu sürümlü bir template registry sistemine taşımak, ardından ikinci bir Vellium şablonuyla mimariyi doğrulamaktır. Bu rapordaki dönüşüm uygulanmadan yalnızca yeni bir PDF eklemek, güvenilir OMR desteği sağlamaz.

Bu belge gelecek geliştirme çalışmasının başlangıç şartnamesi olarak kullanılmalıdır.
