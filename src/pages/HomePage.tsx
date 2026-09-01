import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, CheckCircle2, Database, FileSpreadsheet, Layers3, LockKeyhole, ScanLine, ShieldCheck, Zap } from 'lucide-react';
import { ProductMark } from '../components/Brand';

const V_SEQUENCE = [0, 11, 22, 33, 44, 45, 36, 27, 18, 9];
const V_ORDER_MAP = new Map(V_SEQUENCE.map((idx, step) => [idx, step]));

function generateRandomStats() {
  const rawAvg = (68 + Math.random() * 15).toFixed(1).replace('.', ',');
  const rawDiff = (Math.random() * 4.2 + 1.1).toFixed(1).replace('.', ',');
  const isPositive = Math.random() > 0.25;
  const avgDiff = `${isPositive ? '+' : '-'}${rawDiff} önceki sınava göre`;

  const wrongQ = Math.floor(Math.random() * 95) + 1;
  const wrongRate = Math.floor(Math.random() * 18) + 32;

  let blankQ = Math.floor(Math.random() * 95) + 1;
  if (blankQ === wrongQ) blankQ = (wrongQ % 95) + 2;
  const blankRate = Math.floor(Math.random() * 14) + 16;

  return {
    avg: rawAvg,
    avgDiff,
    mostWrong: `${wrongQ}. soru`,
    mostWrongRate: `%${wrongRate} yanlış işaret`,
    mostBlank: `${blankQ}. soru`,
    mostBlankRate: `%${blankRate} boş bırakıldı`,
  };
}

export function HomePage() {
  const [scanStep, setScanStep] = useState(0);
  const [generatedStats, setGeneratedStats] = useState(generateRandomStats);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let isCancelled = false;

    const runStep = (currentStep: number) => {
      if (isCancelled) return;

      if (currentStep < 10) {
        const nextStep = currentStep + 1;
        setScanStep(nextStep);
        timer = setTimeout(() => runStep(nextStep), 480);
      } else {
        // Döngü tamamlandı (Adım 10): Sonuçları kullanıcıya 2 saniye göster
        timer = setTimeout(() => {
          if (isCancelled) return;
          setGeneratedStats(generateRandomStats());
          setScanStep(0);
          // 400ms sıfır durumunda bekleyip yeni döngüyü başlat
          timer = setTimeout(() => runStep(0), 400);
        }, 2000);
      }
    };

    // İlk açılışta 500ms bekleyip 1. döngüyü başlat
    timer = setTimeout(() => runStep(0), 500);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const progressPercent = scanStep * 10;
  const processedForms = scanStep * 10;
  const activeWorkerCount = scanStep === 10 ? 0 : scanStep === 0 ? 1 : Math.min(4, Math.max(1, Math.ceil((10 - scanStep) / 3)));
  const queuedForms = Math.max(0, 100 - processedForms);
  const loadingDots = '.'.repeat((scanStep % 3) + 1);

  return (
    <div className="home-page">
      <section className="hero section-wrap">
        <div className="hero-copy">
          <div className="eyebrow"><ShieldCheck size={16} /> Yerel işleme · Hesap gerektirmez</div>
          <h1>Optik değerlendirme,<br /><span>veriniz sizde kalırken.</span></h1>
          <p className="hero-lead">
            İhtiyacınız kadar görüntü veya PDF sayfası seçin. Cihaza özel önerilen kontrollü iş kuyruğu
            cevapları tarayıcınızda okusun, öğrenci ve soru analizlerini hazırlasın.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary button-large" to="/tara"><ScanLine size={20} /> Formları taramaya başla <ArrowRight size={18} /></Link>
            <Link className="button button-ghost button-large" to="/rehber">Nasıl çalışır?</Link>
          </div>
          <div className="trust-row" aria-label="Ürün özellikleri">
            <span><LockKeyhole size={16} /> Sunucuya yükleme yok</span>
            <span><Zap size={16} /> 1–4 kontrollü iş</span>
            <span><Database size={16} /> Tarayıcıda kayıt</span>
          </div>
        </div>
        <div className="hero-product" aria-label="Ürün çalışma özeti">
          <div className="hero-glow" />
          <div className="scan-demo-card">
            <div className="scan-demo-header">
              <div className="scan-demo-brand"><ProductMark /><span>Toplu değerlendirme</span><small className="demo-label">Örnek</small></div>
              <span className={`status-pill ${scanStep === 10 ? 'success' : 'warning'}`}>
                <span /> {scanStep === 10 ? 'Değerlendirme tamamlandı' : 'Yerel motor işliyor'}
              </span>
            </div>
            <div className="scan-progress-block">
              <div className="progress-label">
                <span>{scanStep === 10 ? 'Tüm partlar işlendi' : scanStep === 0 ? 'Kuyruk başlatılıyor' : `Part ${Math.min(4, Math.ceil(scanStep / 2.5))} işleniyor`}</span>
                <strong>{processedForms} / 100</strong>
              </div>
              <div className="progress-track">
                <span style={{ width: `${progressPercent}%` }} />
              </div>
              <small>
                {scanStep === 10
                  ? '100 form başarıyla okundu · 100 checkpoint kaydedildi'
                  : `${activeWorkerCount} form etkin · ${queuedForms} form kuyrukta · ${processedForms} checkpoint`}
              </small>
            </div>
            <div className="mini-stat-grid">
              <article>
                <span>Ortalama</span>
                {scanStep === 10 ? (
                  <>
                    <strong className="stat-ready">{generatedStats.avg}</strong>
                    <small>{generatedStats.avgDiff}</small>
                  </>
                ) : (
                  <>
                    <strong className="stat-loading">Hesaplanıyor{loadingDots}</strong>
                    <small>Form verileri toplanıyor</small>
                  </>
                )}
              </article>
              <article>
                <span>En çok yanlış</span>
                {scanStep === 10 ? (
                  <>
                    <strong className="stat-ready">{generatedStats.mostWrong}</strong>
                    <small>{generatedStats.mostWrongRate}</small>
                  </>
                ) : (
                  <>
                    <strong className="stat-loading">Hesaplanıyor{loadingDots}</strong>
                    <small>Soru analizi yapılıyor</small>
                  </>
                )}
              </article>
              <article>
                <span>En çok boş</span>
                {scanStep === 10 ? (
                  <>
                    <strong className="stat-ready">{generatedStats.mostBlank}</strong>
                    <small>{generatedStats.mostBlankRate}</small>
                  </>
                ) : (
                  <>
                    <strong className="stat-loading">Hesaplanıyor{loadingDots}</strong>
                    <small>Cevap matrisi taranıyor</small>
                  </>
                )}
              </article>
            </div>
            <div className="answer-heatmap" aria-hidden="true">
              {Array.from({ length: 50 }, (_, index) => {
                const step = V_ORDER_MAP.get(index);
                const isV = step !== undefined;
                const isMarked = isV && step < scanStep;
                return (
                  <span
                    key={index}
                    className={isMarked ? 'heat-v' : ''}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="section-wrap feature-section">
        <div className="section-heading">
          <span className="eyebrow">Bir değerlendirmeden fazlası</span>
          <h2>Sonuçtan içgörüye, tek akışta.</h2>
          <p>Fotoğrafları seçmekten arşivlenebilir rapor üretmeye kadar tüm işlem cihazınızda tamamlanır.</p>
        </div>
        <div className="feature-grid">
          <article className="feature-card"><div className="feature-icon"><Layers3 /></div><h3>Akıllı part kuyruğu</h3><p>Sabit adet sınırı olmadan alfabetik partlar, cihaza özel 1–4 iş önerisi ve sonuç başına checkpoint.</p></article>
          <article className="feature-card"><div className="feature-icon"><BarChart3 /></div><h3>Soru analizi</h3><p>Doğru, yanlış, boş, seçenek dağılımı, güçlük oranı ve sıralı problem soruları.</p></article>
          <article className="feature-card"><div className="feature-icon"><FileSpreadsheet /></div><h3>Zengin dışa aktarma</h3><p>XLSX, CSV, PDF, JSON, ZIP, cevap matrisi ve yazdırılabilir sınıf özeti.</p></article>
          <article className="feature-card"><div className="feature-icon"><CheckCircle2 /></div><h3>Tek tek doğrulama</h3><p>Öğrenci numarasını ve her sorunun okunan cevabını sonuç ekranında düzeltin.</p></article>
        </div>
      </section>

      <section className="section-wrap privacy-callout">
        <div className="privacy-visual"><LockKeyhole /></div>
        <div><span className="eyebrow">Privacy by design</span><h2>Form görüntüleri ağ isteğine dönüşmez.</h2><p>OpenCV.js işlemleri tarayıcı işçileri içinde yapar. Kalıcı kayda yalnızca metinsel cevaplar ve özetler girer; kaynak fotoğraflar saklanmaz.</p></div>
        <Link to="/gizlilik" className="text-link">Gizlilik modelini incele <ArrowRight size={16} /></Link>
      </section>
    </div>
  );
}
