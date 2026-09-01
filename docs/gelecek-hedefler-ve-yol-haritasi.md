# 🎯 Gelecek Hedefleri ve Ürün Yol Haritası (Product Roadmap)

**Ürün:** Optik Form Okuyucu  
**Geliştirici & Yayıncı:** Vellium  
**Sürüm:** v2.1.0+ (Gelecek Sürümler Planı)  
**Tarih:** Eylül 2026  

---

## 📌 1. Tamamlanan ve Mevcut Sürümde Yer Alan Özellikler

Aşağıdaki özellikler ilk hedefler arasında yer almış ve **v2.1.0 sürümü itibarıyla sisteme %100 entegre edilmiştir:**

- ✅ **4 Parçalı Dinamik Ders / Bölüm Yapısı:** 100 soruluk formun 4 eşit parçaya (1–25, 26–50, 51–75, 76–100) ayrılması, kullanıcı tarafından ders adlarının (*Türkçe, Matematik, Fen, Sosyal vb.*) özelleştirilebilmesi ve soru aralıklarının esnekçe değiştirilebilmesi.
- ✅ **Ayrı Ayrı Net ve Puan Hesaplaması:** Her ders/bölüm için bağımsız Doğru, Yanlış, Boş ve Net puanı dökümü.
- ✅ **Soru Katsayı Matrisi:** Hem bölümlere genel çarpan (örn. 1.5x) hem de 100 sorunun her birine tek tek özel puan ağırlığı atama desteği.
- ✅ **YÖK Uyumlu 3'lü Notlandırma Baremi:** 100 üzerinden başarı notu, 4.00 üzerinden üniversite GPA notu ve resmi YÖK harf notları (`AA, BA, BB, CB, CC, DC, DD, FD, FF`).
- ✅ **Çan Eğrisi (Bağıl Değerlendirme & T-Skor):** Sınıf aritmetik ortalaması ($\bar{X}$), standart sapma ($S$) ve $T = 10Z + 50$ formülüyle bağıl harf notu hesaplama motoru.
- ✅ **Zengin Raporlama & Karne Çıktısı:** Sütunlu Excel (XLSX), CSV, JSON, ZIP ve tek sayfalık resmi PDF öğrenci karneleri.

---

## 🚀 2. Gelecek Sürümler İçin Planlanan 3 Ana Özellik (Öncelik Sırasıyla)

Sistemi dünya standartlarında 100 tam puanlık bir çözüme ulaştıracak öncelikli geliştirmeler:

```mermaid
flowchart LR
    A["Aşama 1 (Kolay)"] -->|Çoklu Kitapçık Desteği| B["Aşama 2 (Orta)"]
    B -->|Kamera ile Canlı Tarama| C["Aşama 3 (Kapsamlı)"]
    C -->|Özel Şablon Sihirbazı & Mağaza| D["100/100 Tam Olgunluk"]
```

---

### 🟢 Aşama 1: Çoklu Kitapçık Desteği (A / B / C / D Kitapçıkları)
* **Zorluk Seviyesi:** **Kolay (Tahmini Efor: 1 – 2 Saat)**
* **Öncelik:** **Yüksek (P0)**

#### Hedef & Kapsam:
Sınavlarda kopya önleme amacıyla kullanılan farklı soru sıralamasına sahip kitapçık türlerinin tek oturumda okunabilmesi.

#### Teknik Uygulama Planı:
1. **OMR Kitapçık Algılama:** Formun üst bilgi alanındaki `[A] [B] [C] [D]` baloncuklarının `omr.worker.ts` tarafından taranması.
2. **Çoklu Cevap Anahtarı Girişi:** Sınav kurulum ekranında her kitapçık türü için ayrı sekme veya A kitapçığını referans alıp diğer kitapçıklar için soru eşleme matrisi (*Örn: B Kitapçığı S1 = A Kitapçığı S15*) tanımlama.
3. **Puanlama Entegrasyonu:** `scoring.ts` içindeki `compareWithAnswerKey` fonksiyonunun öğrencinin kodladığı kitapçık türünü baz alarak doğru anahtarla eşleştirilmesi.

---

### 🟡 Aşama 2: Kamera ile Canlı / Anlık Tarama (Webcam & Telefon Kamerası)
* **Zorluk Seviyesi:** **Orta (Tahmini Efor: 3 – 5 Saat)**
* **Öncelik:** **Orta (P1)**

#### Hedef & Kapsam:
Öğretmenlerin kağıtları tek tek tarayıcıdan geçirmek veya fotoğraf yüklemek yerine telefon/bilgisayar kamerasını kağıda tutarak 1 saniyede anlık okutabilmesi.

#### Teknik Uygulama Planı:
1. **Canlı Video Akışı:** Tarayıcının yerel `navigator.mediaDevices.getUserMedia` API'si ile video vizörünün açılması.
2. **Görsel Kılavuz & Vizör:** Ekranda optik form sınırlarını gösteren dinamik bir hizalama çerçevesi.
3. **Akıllı Otomatik Yakalama (Auto-Capture):** OpenCV.js ile saniyede 3–5 kare işlenerek formun 4 köşe siyah kılavuz noktası yüksek güvenilirlikle algılandığında çerçevenin yeşile dönmesi, "Bip" sesi/titreşim eşliğinde fotoğrafın otomatik çekilip sonuç listesine eklenmesi.

---

### 🔴 Aşama 3: Özelleştirilebilir Şablon Sihirbazı & Şablon Mağazası
* **Zorluk Seviyesi:** **Kapsamlı (Tahmini Efor: 1 – 2 Gün)**
* **Öncelik:** **Gelecek Sürüm (P2)**

#### Hedef & Kapsam:
Sabit 100 soru haricinde kullanıcıların 15, 20, 30, 40 veya 50 soruluk mini sınavlar, quizler veya denemeler için kendi özel optik formlarını oluşturup indirebilmesi ve indireceği hazır şablonları okutabilmesi.

#### Teknik Uygulama Planı:
1. **Dinamik PDF Üretici (jsPDF):** Seçilen soru sayısı ve şık adedine göre vektörel baskıya hazır standart PDF formu üreten sihirbaz arayüzü.
2. **Merkezi Şablon Şeması (`FormTemplateDefinition`):** Her şablonun köşe koordinatlarını ve baloncuk grid haritasını tutan JSON veri modeli.
3. **QR / Barkodlu Otomatik Şablon Tanıma:** Formun köşesine basılan küçük QR kod ile OMR motorunun formun hangi şablona ait olduğunu kullanıcı seçimi olmadan otomatik algılaması.
4. **Şablon Mağazası (Template Hub):** Kullanıcıların sınav türlerine göre (LGS, YKS, Üniversite Vize/Final, Quiz) hazırlanmış standart şablonları tek tıkla indirebileceği dahili şablon galerisi.

---

## 📊 Yol Haritası İlerleme Tablosu

| Özellik | Zorluk | Durum | Planlanan Sürüm |
| :--- | :---: | :---: | :---: |
| **4 Bölümlü Ders Yapılandırması** | Kolay | 🟢 **Tamamlandı** | v2.1.0 |
| **Soru Katsayı ve Puanlama Ağırlıkları** | Kolay | 🟢 **Tamamlandı** | v2.1.0 |
| **YÖK 3'lü Notlandırma (100 / GPA / Harf)** | Orta | 🟢 **Tamamlandı** | v2.1.0 |
| **Çan Eğrisi (T-Skor BDS) Motoru** | Orta | 🟢 **Tamamlandı** | v2.1.0 |
| **Çoklu Kitapçık Desteği (A/B/C/D)** | Kolay | 🔵 **Sıradaki (Aşama 1)** | v2.2.0 |
| **Kamera ile Canlı Vizör & Auto-Capture** | Orta | 🔵 **Planlandı (Aşama 2)** | v2.3.0 |
| **Şablon Sihirbazı & Şablon Mağazası** | Kapsamlı | 🔵 **Planlandı (Aşama 3)** | v3.0.0 |
