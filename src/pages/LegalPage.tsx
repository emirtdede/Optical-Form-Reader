import { ExternalLink } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { COMPANY_NAME, COMPANY_URL, LAST_UPDATED, PRODUCT_NAME } from '../constants';

interface LegalDocument {
  title: string;
  eyebrow: string;
  intro: string;
  sections: Array<{ title: string; paragraphs?: string[]; items?: string[] }>;
}

const documents: Record<string, LegalDocument> = {
  '/gizlilik': {
    title: 'Gizlilik Politikası', eyebrow: 'Veri gizliliği', intro: `${PRODUCT_NAME}, form görüntülerini sunucuya göndermeden cihazınızda işler. Bu politika uygulamanın veri akışını açıklar.`,
    sections: [
      { title: 'İşlenen veriler', paragraphs: ['Cevap anahtarları, öğrenci numaraları, işaretlenen cevaplar, puanlar, kaynak parmak izleri, işlem durumu ve oluşturduğunuz değerlendirme adları yalnızca tarayıcınızda işlenir. Görüntüler ve PDF sayfa çizimleri işlem bitince bellekten kaldırılır ve kalıcı olarak saklanmaz.'] },
      { title: 'Sunucuya aktarım', paragraphs: ['Uygulama, optik form görüntülerini veya oluşturulan sonuç kayıtlarını Vellium sunucularına aktarmaz. Statik site sağlayıcısı, sayfayı sunabilmek ve güvenliği sağlamak için IP adresi, istek zamanı, tarayıcı türü gibi standart erişim günlüklerini kendi koşulları kapsamında işleyebilir.'] },
      { title: 'Yerel kayıt ve silme', paragraphs: ['Sonuçlar IndexedDB içinde cihaz ve tarayıcı profiline bağlı olarak tutulur. Veriler sayfasından tek tek veya topluca silinebilir ve JSON yedeği alınabilir. Tarayıcı verilerini temizlemek de kayıtları kaldırır.'] },
      { title: 'Analitik ve reklam', paragraphs: ['İlk sürümde analitik, reklam, yeniden hedefleme veya davranış izleme aracı kullanılmaz. Uygulama tarafından pazarlama profili oluşturulmaz.'] },
      { title: 'Çocuklara ait veriler', paragraphs: ['Öğrenci verilerini sisteme ekleyen öğretmen, kurum veya kullanıcı; gerekli hukuki yetkiye, bilgilendirmeye ve gerektiğinde veli iznine sahip olduğunu doğrulamakla sorumludur. Vellium, yerel form içeriğine erişmez.'] },
      { title: 'İletişim ve değişiklikler', paragraphs: [`Gizlilik talepleri için ${COMPANY_URL} üzerinden ${COMPANY_NAME} ile iletişim kurabilirsiniz. Politika değişikliklerinde bu sayfadaki güncelleme tarihi yenilenir.`] },
    ],
  },
  '/kvkk-aydinlatma': {
    title: 'KVKK Aydınlatma Metni', eyebrow: '6698 sayılı Kanun', intro: 'Bu metin, uygulamanın yerel işleme modeli kapsamında kişisel verilerin nasıl ele alındığını açıklar.',
    sections: [
      { title: 'Veri sorumlusu ve kapsam', paragraphs: [`Uygulamanın hizmet sağlayıcısı ${COMPANY_NAME}'dur. ${PRODUCT_NAME} içinde yüklenen optik görüntüler ve sonuçlar Vellium tarafından teslim alınmaz; işlemler kullanıcının cihazında gerçekleşir. Eğitim kurumu veya kullanıcı, kendi öğrencileri yönünden ayrıca veri sorumlusu olabilir.`] },
      { title: 'Veri kategorileri ve amaç', items: ['Öğrenci numarası: sonuçları eşleştirmek ve raporlamak.', 'Cevap ve puan verisi: ölçme-değerlendirme yapmak.', 'Değerlendirme başlığı ve zaman bilgisi: yerel arşivi düzenlemek.', 'Teknik erişim verisi: statik web sayfasının güvenli biçimde sunulması.'] },
      { title: 'Toplama yöntemi ve hukuki sebep', paragraphs: ['Form içeriği, kullanıcının dosya seçmesiyle tarayıcıda otomatik yöntemle işlenir. Eğitim kurumu veya kullanıcı, öğrenci verileri bakımından kendi faaliyetinin hukuki sebebini belirlemeli ve ilgili kişileri bilgilendirmelidir. Vellium tarafında olabilecek standart web erişim kayıtları; bilgi güvenliği ve hizmetin sunulmasına ilişkin meşru menfaat kapsamında, ilgili sağlayıcıların saklama politikalarıyla sınırlı olabilir.'] },
      { title: 'Aktarım ve saklama', paragraphs: ['Form görüntüleri ve sonuç kayıtları uygulama tarafından üçüncü kişilere aktarılmaz. Yerel sonuçların ne kadar süre tutulacağı kullanıcıya bağlıdır. Kullanıcı bunları istediği anda silebilir. Statik barındırma altyapısının erişim günlükleri kendi hizmet şartlarına tabi olabilir.'] },
      { title: 'İlgili kişi hakları', paragraphs: ['KVKK m.11 kapsamındaki haklar bakımından, veriyi uygulamaya ekleyen eğitim kurumu veya kullanıcı öncelikli muhataptır. Vellium’un kontrolündeki bir kayıtla ilgili talepler Vellium.dev üzerinden iletilebilir. Kimlik ve iletişim bilgilerinin resmî şirket kayıtlarıyla yayından önce hukuk danışmanı tarafından tamamlanması önerilir.'] },
    ],
  },
  '/kullanim-kosullari': {
    title: 'Kullanım Koşulları', eyebrow: 'Hizmet şartları', intro: `Bu koşullar ${PRODUCT_NAME} hizmetini kullanımınızı düzenler.`,
    sections: [
      { title: 'Hizmetin niteliği', paragraphs: ['Hizmet, desteklenen standart optik şablonları tarayıcı içinde analiz eden ücretsiz bir yardımcı araçtır. Hesap, bulut senkronizasyonu veya kalıcı sunucu yedeği sunmaz.'] },
      { title: 'İzin verilen kullanım', items: ['Yalnızca işlemeye yetkili olduğunuz form ve öğrenci verilerini kullanın.', 'Sonuçları resmî karar öncesinde makul biçimde doğrulayın.', 'Hizmeti hukuka aykırı, yanıltıcı veya kişilerin haklarını ihlal eden amaçlarla kullanmayın.', 'Uygulamanın güvenliğini veya erişilebilirliğini bozmaya çalışmayın.'] },
      { title: 'Fikri mülkiyet', paragraphs: ['Ürün adı, özgün arayüz, ürün logosu ve Vellium markası üzerindeki haklar saklıdır. Açık kaynak bileşenler kendi lisanslarıyla sunulur. İndirilebilir optik şablon yalnızca bu hizmetle ölçme-değerlendirme amacıyla çoğaltılabilir.'] },
      { title: 'Değişiklik ve süreklilik', paragraphs: ['Hizmet özellikleri, desteklenen tarayıcılar ve şablon standardı önceden bildirim olmaksızın güncellenebilir. Kritik değişiklikler sürüm notlarında veya bu sayfalarda belirtilir.'] },
      { title: 'Uygulanacak hukuk', paragraphs: ['Aksi zorunlu hukuk kuralı bulunmadıkça Türkiye Cumhuriyeti hukuku uygulanır. Tüketici ve kişisel veri mevzuatından doğan zorunlu haklar saklıdır.'] },
    ],
  },
  '/sorumluluk-reddi': {
    title: 'Sorumluluk Reddi Beyanı', eyebrow: 'Sonuç doğruluğu', intro: 'Optik okuma sonuçları yardımcı niteliktedir; tek başına kesin veya resmî ölçme-değerlendirme kaydı sayılmamalıdır.',
    sections: [
      { title: 'Okuma hataları', paragraphs: ['Işık, gölge, perspektif, baskı ölçeği, düşük çözünürlük, silgi izi, çift işaret ve farklı şablonlar hatalı sonuç üretebilir. Kullanıcı, özellikle belirsiz veya düşük güvenli işaretleri kaynak formla karşılaştırmalıdır.'] },
      { title: 'Karar sorumluluğu', paragraphs: ['Not verme, sıralama, kabul, disiplin veya öğrenciyi etkileyen başka bir karar öncesinde sonuçların yetkili kişi tarafından doğrulanması gerekir. Otomatik sonuçlardan doğan kararların sorumluluğu kullanıcıya ve ilgili kuruma aittir.'] },
      { title: 'Veri kaybı', paragraphs: ['Tarayıcı verilerinin temizlenmesi, gizli sekmenin kapanması, cihaz arızası veya depolama kotası kayıtları silebilir. Düzenli JSON ve XLSX yedeği alınması önerilir.'] },
      { title: 'Garanti sınırı', paragraphs: ['Hizmet mevcut haliyle sunulur. Emredici mevzuattan doğan sorumluluklar saklı kalmak üzere kesintisiz erişim, her görüntünün okunması veya belirli bir amaca uygunluk garantisi verilmez.'] },
    ],
  },
  '/yerel-depolama': {
    title: 'Yerel Depolama Politikası', eyebrow: 'Cihazda kayıt', intro: 'Bu uygulama, kullanıcı kayıtları için bulut veritabanı yerine tarayıcı depolamasını kullanır.',
    sections: [
      { title: 'Kullanılan teknolojiler', items: ['IndexedDB: değerlendirme üst verisi, öğrenci sonuçları, part ayarları ve işlem checkpoint/manifestosu.', 'localStorage: yalnızca açık/koyu tema tercihi.', 'Cache Storage: PWA dosyalarını çevrimdışı kullanıma hazırlamak için uygulama kabuğu, OpenCV ve PDF çalışma dosyaları.'] },
      { title: 'Saklanmayan içerikler', paragraphs: ['Kaynak JPG, PNG, WebP, PDF ve ZIP dosyaları kalıcı depolamaya yazılmaz. İşlenen bitmapler, PDF canvas verisi ve OpenCV matrisleri her kaynak tamamlandığında serbest bırakılır. Devam işlemi için kullanıcı kaynakları yeniden seçer.'] },
      { title: 'Cihaza bağlılık', paragraphs: ['Kayıtlar başka cihaz, tarayıcı veya tarayıcı profiline otomatik olarak taşınmaz. Gizli gezinme sonunda kaybolabilir ve tarayıcı temizleme işlemlerinden etkilenir. Aynı tarayıcı profilini kullanan kişiler kayıtlara erişebilir.'] },
      { title: 'Kullanıcı denetimi', paragraphs: ['Veriler sayfasından JSON yedeği alınabilir, yedek geri yüklenebilir, kalıcı depolama izni talep edilebilir ve tüm yerel kayıtlar silinebilir.'] },
    ],
  },
  '/cerez-politikasi': {
    title: 'Çerez Politikası', eyebrow: 'İzleme tercihleri', intro: 'Uygulamanın ilk sürümü uygulama çerezi, reklam çerezi veya analitik çerezi kullanmaz.',
    sections: [
      { title: 'Çerez kullanılmaması', paragraphs: ['Oturum açma, reklam kişiselleştirme, çapraz site izleme veya davranış analizi yapılmadığı için uygulama tarafından çerez oluşturulmaz. Bu nedenle bir çerez onay paneli gösterilmez.'] },
      { title: 'Çerez olmayan yerel teknolojiler', paragraphs: ['Tema tercihi localStorage içinde; değerlendirme kayıtları IndexedDB içinde; çevrimdışı uygulama dosyaları Cache Storage içinde tutulur. Bunlar hakkında ayrıntı için Yerel Depolama Politikası’nı inceleyin.'] },
      { title: 'Barındırma sağlayıcısı', paragraphs: ['Statik barındırma ve güvenlik katmanı, kötüye kullanımı önlemek için standart istek günlükleri veya zorunlu güvenlik mekanizmaları kullanabilir. Vellium, uygulamaya pazarlama ya da analitik izleyicisi eklememiştir.'] },
    ],
  },
  '/acik-kaynak-lisanslari': {
    title: 'Açık Kaynak Lisansları', eyebrow: 'Üçüncü taraf yazılımlar', intro: 'Bu ürün aşağıdaki açık kaynak bileşenlerden yararlanır. Telif bildirimleri ve lisans koşulları ilgili paketlerde korunur.',
    sections: [
      { title: 'Çalışma zamanı bileşenleri', items: ['OpenCV.js ve @techstark/opencv-js — Apache License 2.0', 'PDF.js / pdfjs-dist — Apache License 2.0', 'React ve React DOM — MIT License', 'React Router — MIT License', 'idb — ISC License', 'Lucide React — ISC License', 'ExcelJS — MIT License', 'jsPDF — MIT License', 'jsPDF-AutoTable — MIT License', 'JSZip — MIT veya GPL-3.0-or-later'] },
      { title: 'Geliştirme bileşenleri', items: ['Vite — MIT License', 'TypeScript — Apache License 2.0', 'Vitest — MIT License', 'Testing Library — MIT License'] },
      { title: 'Tam lisans metinleri', paragraphs: ['Dağıtım kaynak kodundaki package-lock.json sürümleri sabitler. Her bileşenin tam lisans metni ilgili npm paketinde yer alır. Açık kaynak adlarının kullanılması, ilgili proje sahiplerinin bu ürünü desteklediği anlamına gelmez.'] },
    ],
  },
  '/erisilebilirlik': {
    title: 'Erişilebilirlik Bildirimi', eyebrow: 'WCAG 2.2 AA hedefi', intro: `${COMPANY_NAME}, ${PRODUCT_NAME} arayüzünü mümkün olduğunca geniş bir kullanıcı kitlesi için erişilebilir kılmayı hedefler.`,
    sections: [
      { title: 'Uygulanan önlemler', items: ['Klavye ile erişilebilir navigasyon ve kontroller.', 'Görünür odak halkaları ve ana içeriğe geç bağlantısı.', 'Açık/koyu temada en az AA düzeyinde renk kontrastı hedefi.', 'Form alanlarında metinsel etiketler ve durum mesajlarında canlı bölgeler.', 'Renk dışında ikon, metin veya biçimle durum ayrımı.', 'Mobil yakınlaştırmayı engellemeyen responsive düzen.'] },
      { title: 'Bilinen sınırlamalar', paragraphs: ['Büyük cevap tabloları küçük ekranlarda yatay kaydırma gerektirebilir. Üçüncü taraf PDF yazdırma iletişim kutularının erişilebilirliği tarayıcıya bağlıdır. OpenCV başlatma süresi düşük güçlü cihazlarda uzun olabilir.'] },
      { title: 'Geri bildirim', paragraphs: [`Bir erişilebilirlik engeli yaşarsanız sayfa, tarayıcı ve yardımcı teknoloji bilgisiyle ${COMPANY_URL} üzerinden bildirebilirsiniz.`] },
    ],
  },
  '/iletisim': {
    title: 'İletişim', eyebrow: 'Destek ve geri bildirim', intro: `${PRODUCT_NAME}, ${COMPANY_NAME} tarafından tasarlanmış ve geliştirilmiştir.`,
    sections: [
      { title: 'Teknik destek', paragraphs: ['Okunamayan form, tarayıcı uyumluluğu veya dışa aktarma sorunlarında kullandığınız tarayıcı sürümünü ve kişisel veri içermeyen hata açıklamasını paylaşın. Form görüntülerini gerekli yetki olmadan destek talebine eklemeyin.'] },
      { title: 'Gizlilik ve hukuk', paragraphs: ['Kişisel veri veya yasal taleplerde talebin kapsamını ve sizinle güvenli biçimde iletişim kurulabilecek bilgiyi belirtin. Resmî şirket unvanı, tebligat adresi ve ayrı gizlilik e-posta adresi yayından önce Vellium tarafından tamamlanmalıdır.'] },
      { title: 'Vellium.dev', paragraphs: ['Şirket, ürünler ve iletişim kanalları için Vellium web sitesini ziyaret edin.'] },
    ],
  },
};

export function LegalPage() {
  const { pathname } = useLocation();
  const document = documents[pathname] ?? documents['/gizlilik'];
  return (
    <div className="page-section section-wrap legal-layout">
      <aside className="legal-nav"><span>Yasal ve güven</span>{Object.entries(documents).map(([path, item]) => <Link key={path} to={path} className={pathname === path ? 'is-active' : ''}>{item.title}</Link>)}</aside>
      <article className="legal-document">
        <header><span className="eyebrow">{document.eyebrow}</span><h1>{document.title}</h1><p>{document.intro}</p><small>Son güncelleme: {LAST_UPDATED}</small></header>
        {document.sections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.items && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}</section>)}
        {pathname === '/iletisim' && <a className="button button-primary legal-external" href={COMPANY_URL} target="_blank" rel="noopener noreferrer">Vellium.dev sitesini aç <ExternalLink size={17} /></a>}
        <div className="legal-disclaimer"><strong>Yasal inceleme notu:</strong> Bu metinler ürünün teknik veri akışını doğru açıklamak amacıyla hazırlanmıştır; hukuk danışmanlığı değildir. Resmî tüzel kişi unvanı, adres ve başvuru kanalı yayın öncesinde yetkili hukuk uzmanıyla doğrulanmalıdır.</div>
      </article>
    </div>
  );
}
