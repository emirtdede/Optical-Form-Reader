import { Link } from 'react-router-dom';
import {
  Download,
  FileCheck2,
  HardDrive,
  Lock,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { COMPANY_URL, FORM_TEMPLATE_URL, PRODUCT_NAME } from '../constants';
import { ProductMark } from './Brand';

const productLinks = [
  { to: '/tara', label: 'Form Tara & Değerlendir' },
  { to: '/sonuclar', label: 'Sınav Sonuçları & Analiz' },
  { to: '/rehber', label: 'Kullanım Rehberi' },
  { to: '/rehber#sik-sorulan-sorular', label: 'Sıkça Sorulan Sorular' },
  { to: '/ayarlar', label: 'Veri Depolama & Yedekler' },
];

const legalLinks = [
  { to: '/gizlilik', label: 'Gizlilik Politikası' },
  { to: '/kvkk-aydinlatma', label: 'KVKK Aydınlatma Metni' },
  { to: '/kullanim-kosullari', label: 'Kullanım Koşulları' },
  { to: '/sorumluluk-reddi', label: 'Sorumluluk Reddi' },
  { to: '/cerez-politikasi', label: 'Çerez Politikası' },
];

const supportLinks = [
  { to: '/yerel-depolama', label: 'Yerel Depolama Mimarisi' },
  { to: '/acik-kaynak-lisanslari', label: 'Açık Kaynak Lisansları' },
  { to: '/erisilebilirlik', label: 'Erişilebilirlik Bildirimi' },
  { to: '/iletisim', label: 'İletişim & Geri Bildirim' },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer" role="contentinfo">
      {/* 1. Üst Güven & Teknoloji Vurguları (Trust Ribbon) */}
      <div className="footer-ribbon">
        <div className="footer-ribbon-inner">
          <div className="ribbon-card">
            <div className="ribbon-icon">
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            <div className="ribbon-content">
              <h4>%100 İstemci Taraflı Gizlilik</h4>
              <p>Optik form görüntüleri ve sınav verileri cihazınızdan asla ayrılmaz, sunucuya aktarılmaz.</p>
            </div>
          </div>

          <div className="ribbon-card">
            <div className="ribbon-icon">
              <Zap size={20} aria-hidden="true" />
            </div>
            <div className="ribbon-content">
              <h4>Yüksek Hızlı Yerel Analiz</h4>
              <p>Gelişmiş görüntü işleme algoritmaları doğrudan tarayıcınızda milisaniyeler içinde sonuç üretir.</p>
            </div>
          </div>

          <div className="ribbon-card">
            <div className="ribbon-icon">
              <HardDrive size={20} aria-hidden="true" />
            </div>
            <div className="ribbon-content">
              <h4>Tarayıcı İçi Güvenli Depolama</h4>
              <p>Sınav oturumlarınız ve sonuçlarınız tarayıcınızın yerel hafızasında saklanır, verileriniz güvende kalır.</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Ana Footer Sütunları (Main Footer Grid) */}
      <div className="footer-main">
        <div className="footer-inner-grid">
          {/* Kolon 1: Marka & Teknoloji Mimarisi */}
          <div className="footer-col footer-col-brand">
            <Link to="/" className="footer-brand-title" aria-label={`${PRODUCT_NAME} ana sayfaya dön`}>
              <ProductMark className="footer-brand-icon" />
              <span className="footer-brand-name">{PRODUCT_NAME}</span>
            </Link>
            
            <p className="footer-brand-desc">
              Görüntü ve PDF optik sınav formlarını cihazdan çıkarmadan, partlar halinde yüksek doğrulukla değerlendiren yerel-first web platformu.
            </p>

            <ul className="footer-brand-features">
              <li>
                <Lock size={13} aria-hidden="true" />
                <span>Sıfır Telemetri</span>
              </li>
              <li>
                <FileCheck2 size={13} aria-hidden="true" />
                <span>100 Soru Şablonu</span>
              </li>
              <li>
                <ShieldCheck size={13} aria-hidden="true" />
                <span>KVKK &amp; GDPR Uyumlu</span>
              </li>
            </ul>
          </div>

          {/* Kolon 2: Hızlı Erişim & Ürün */}
          <div className="footer-col">
            <h3 className="footer-col-title">Ürün &amp; İşlemler</h3>
            <ul className="footer-nav-list">
              {productLinks.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="footer-nav-link">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href={FORM_TEMPLATE_URL}
                  download="Optik_Form.pdf"
                  className="footer-nav-link footer-nav-download"
                  title="Resmi Optik Form PDF Şablonunu İndir"
                >
                  <Download size={13} aria-hidden="true" />
                  <span>Optik Form PDF İndir</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Kolon 3: Yasal Uyumluluk & Güvenlik */}
          <div className="footer-col">
            <h3 className="footer-col-title">Yasal &amp; Uyumluluk</h3>
            <ul className="footer-nav-list">
              {legalLinks.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="footer-nav-link">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Kolon 4: Güvenlik & Destek */}
          <div className="footer-col">
            <h3 className="footer-col-title">Güvenlik &amp; Destek</h3>
            <ul className="footer-nav-list">
              {supportLinks.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="footer-nav-link">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 3. Alt Bar: Vellium İmzası & Işık Maskesi Efekti (In-Letter Shimmer) */}
      <div className="footer-bottom">
        <div className="footer-bottom-inner">
          <div className="unified-shimmer-wrapper">
            {/* 1. Taban Katmanı (Etkileşimli ve Tıklanabilir) */}
            <div className="unified-shimmer-base">
              <span>© {currentYear} {PRODUCT_NAME}. Tüm Hakları Saklıdır.</span>
              <span className="shimmer-divider">•</span>
              <a
                href={COMPANY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="vellium-link-anchor"
                title="Designed & Developed by Vellium"
              >
                <svg
                  viewBox="0 145 1024 818"
                  className="vellium-svg-logo"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden="true"
                >
                  <g transform="translate(0.000000,1024.000000) scale(0.100000,-0.100000)" stroke="none">
                    <path d="M53 8745 c-34 -24 -29 -64 12 -112 52 -61 101 -80 235 -93 410 -38 673 -149 923 -389 161 -155 293 -332 442 -591 106 -186 1284 -2552 2777 -5580 621 -1260 655 -1327 674 -1334 22 -8 47 38 236 422 773 1576 1151 2344 1548 3147 117 237 259 525 315 640 350 715 1261 2549 1313 2643 256 465 528 758 836 903 161 75 298 110 530 135 175 19 214 32 266 91 46 53 53 93 18 117 -27 19 -189 21 -718 6 -626 -18 -768 -30 -1008 -86 -260 -61 -467 -156 -682 -313 -97 -71 -300 -274 -374 -374 -147 -198 -178 -257 -674 -1272 -115 -236 -373 -761 -572 -1165 -200 -404 -504 -1023 -676 -1375 -369 -754 -336 -690 -354 -690 -8 0 -67 106 -141 255 -185 368 -886 1784 -1431 2890 -469 952 -541 1092 -626 1225 -287 449 -705 733 -1233 839 -228 46 -487 61 -1203 72 -373 5 -413 5 -433 -11z m1717 -370 c184 -30 402 -121 560 -234 171 -121 350 -325 463 -527 55 -99 606 -1204 1367 -2744 608 -1230 930 -1873 946 -1890 12 -13 16 -13 28 0 13 13 278 547 751 1515 62 127 240 487 395 800 155 314 331 669 390 790 355 726 736 1487 780 1560 166 275 368 471 615 597 207 105 451 166 553 139 76 -21 66 -62 -72 -288 -85 -140 -211 -382 -396 -758 -92 -187 -353 -713 -580 -1170 -792 -1595 -1317 -2664 -1742 -3550 -399 -830 -687 -1410 -702 -1413 -20 -4 -297 544 -701 1388 -430 899 -2542 5154 -2657 5355 -26 44 -80 137 -121 208 -86 146 -94 169 -73 202 24 37 64 41 196 20z" />
                  </g>
                </svg>
                <span>
                  Designed &amp; Developed by <strong>Vellium</strong>
                </span>
              </a>
            </div>

            {/* 2. Işık Maskesi Katmanı (Kusursuz Üst Örtüşme & Pointer-Events-None) */}
            <div className="unified-shimmer-shine" aria-hidden="true">
              <span>© {currentYear} {PRODUCT_NAME}. Tüm Hakları Saklıdır.</span>
              <span className="shimmer-divider">•</span>
              <span className="vellium-link-anchor">
                <svg
                  viewBox="0 145 1024 818"
                  className="vellium-svg-logo"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden="true"
                >
                  <g transform="translate(0.000000,1024.000000) scale(0.100000,-0.100000)" stroke="none">
                    <path d="M53 8745 c-34 -24 -29 -64 12 -112 52 -61 101 -80 235 -93 410 -38 673 -149 923 -389 161 -155 293 -332 442 -591 106 -186 1284 -2552 2777 -5580 621 -1260 655 -1327 674 -1334 22 -8 47 38 236 422 773 1576 1151 2344 1548 3147 117 237 259 525 315 640 350 715 1261 2549 1313 2643 256 465 528 758 836 903 161 75 298 110 530 135 175 19 214 32 266 91 46 53 53 93 18 117 -27 19 -189 21 -718 6 -626 -18 -768 -30 -1008 -86 -260 -61 -467 -156 -682 -313 -97 -71 -300 -274 -374 -374 -147 -198 -178 -257 -674 -1272 -115 -236 -373 -761 -572 -1165 -200 -404 -504 -1023 -676 -1375 -369 -754 -336 -690 -354 -690 -8 0 -67 106 -141 255 -185 368 -886 1784 -1431 2890 -469 952 -541 1092 -626 1225 -287 449 -705 733 -1233 839 -228 46 -487 61 -1203 72 -373 5 -413 5 -433 -11z m1717 -370 c184 -30 402 -121 560 -234 171 -121 350 -325 463 -527 55 -99 606 -1204 1367 -2744 608 -1230 930 -1873 946 -1890 12 -13 16 -13 28 0 13 13 278 547 751 1515 62 127 240 487 395 800 155 314 331 669 390 790 355 726 736 1487 780 1560 166 275 368 471 615 597 207 105 451 166 553 139 76 -21 66 -62 -72 -288 -85 -140 -211 -382 -396 -758 -92 -187 -353 -713 -580 -1170 -792 -1595 -1317 -2664 -1742 -3550 -399 -830 -687 -1410 -702 -1413 -20 -4 -297 544 -701 1388 -430 899 -2542 5154 -2657 5355 -26 44 -80 137 -121 208 -86 146 -94 169 -73 202 24 37 64 41 196 20z" />
                  </g>
                </svg>
                <span>
                  Designed &amp; Developed by <strong>Vellium</strong>
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
