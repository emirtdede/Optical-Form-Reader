import { Download, FileCheck2, ImagePlus, ListChecks, ScanLine, ShieldAlert, SunMedium } from 'lucide-react';
import { FORM_TEMPLATE_URL } from '../constants';

const steps = [
  { icon: Download, title: 'Standart formu indirin', text: 'Yalnızca uygulamanın sunduğu 100 soruluk, A–E seçenekli şablon desteklenir. Ölçeği değiştirmeden A4 yazdırın.' },
  { icon: FileCheck2, title: 'Cevap anahtarını doldurun', text: 'Her soruda tam bir seçenek işaretleyin. Eksik veya çift işaretli anahtar işleme alınmaz.' },
  { icon: ImagePlus, title: 'Öğrenci formlarını seçin', text: 'JPG, PNG, WebP, PDF veya görüntü içeren ZIP seçin. PDF içindeki her sayfa bir öğrenci formu olarak sıraya alınır.' },
  { icon: ScanLine, title: 'Öneriyi onaylayıp tarayın', text: 'İçerik sayısı ve cihaz kapasitesine göre part boyutu ile 1–4 eşzamanlı iş önerilir. Öneriyi uyguladıktan sonra değerleri değiştirebilirsiniz.' },
  { icon: ListChecks, title: 'Kontrol edin ve aktarın', text: 'Her part bittiğinde ayrı ZIP alın; işlem sonunda tüm partları tek ZIP içinde indirin. Her tamamlanan sonuç kesintilere karşı anında kaydedilir.' },
];

export function GuidePage() {
  return (
    <div className="page-section section-wrap narrow-wrap">
      <header className="page-header split-header">
        <div><span className="eyebrow">Kullanım rehberi</span><h1>Beş adımda güvenilir optik okuma.</h1><p>En iyi sonuç için standart şablonu ve aşağıdaki çekim kurallarını izleyin.</p></div>
        <a className="button button-primary" href={FORM_TEMPLATE_URL} download><Download size={18} /> Optik form şablonunu indir</a>
      </header>

      <ol className="guide-steps">
        {steps.map(({ icon: Icon, title, text }, index) => (
          <li key={title}><span className="step-index">{String(index + 1).padStart(2, '0')}</span><div className="step-icon"><Icon /></div><div><h2>{title}</h2><p>{text}</p></div></li>
        ))}
      </ol>

      <section className="guide-grid">
        <article className="info-panel"><SunMedium /><h2>Çekim kalitesi</h2><ul><li>Formun dört köşesi kadrajda olsun.</li><li>Gölge, parlama ve güçlü perspektiften kaçının.</li><li>En az 1200 px uzun kenar önerilir.</li><li>Formu düz zeminde, kamerayı paralel tutarak çekin.</li></ul></article>
        <article className="info-panel"><ShieldAlert /><h2>İşaretleme kuralları</h2><ul><li>Baloncuğu taşırmadan koyu biçimde doldurun.</li><li>Silinen cevabın iz bırakmadığından emin olun.</li><li>Bir soruda birden fazla işaret belirsiz sayılır.</li><li>Öğrenci numarası okunamazsa dosya adındaki 5–12 haneli sayı kullanılır.</li></ul></article>
      </section>

      <section className="compatibility-note">
        <h2>Şablon uyumluluğu</h2>
        <p>Bu sürüm genel amaçlı bir optik form tanıma sistemi değildir. Yalnızca indirilebilir mevcut Vellium şablonundaki 100 soru, A–E seçenekleri, dört cevap sütunu ve öğrenci numarası ızgarası desteklenir. Daha az veya daha fazla soru içeren farklı formlar reddedilir.</p>
      </section>

      <section className="compatibility-note">
        <h2>Kesinti ve devam etme</h2>
        <p>Kaynak görüntüler gizlilik için kalıcı saklanmaz; tamamlanan metinsel sonuçlar ve işlem manifestosu IndexedDB'ye yazılır. İşlem kesilirse ZIP ile hazır sonuçları alabilir veya aynı dosyaları yeniden seçebilirsiniz. “Tamamlananı atla” seçeneği içerik parmak izlerini kullanır; “Sıfırdan yeniden işle” seçeneği mevcut sonucu yeniler.</p>
      </section>
    </div>
  );
}
