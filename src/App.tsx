import { Component, lazy, Suspense, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { AppShell } from './components/AppShell';
import { AppDataProvider, useAppData } from './context/AppDataContext';
import { useTheme } from './hooks/useTheme';

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const ScannerPage = lazy(() => import('./pages/ScannerPage').then((m) => ({ default: m.ScannerPage })));
const ResultsPage = lazy(() => import('./pages/ResultsPage').then((m) => ({ default: m.ResultsPage })));
const GuidePage = lazy(() => import('./pages/GuidePage').then((m) => ({ default: m.GuidePage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const LegalPage = lazy(() => import('./pages/LegalPage').then((m) => ({ default: m.LegalPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

function PageSuspenseFallback() {
  return (
    <div className="page-section section-wrap" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="skeleton-card" style={{ width: '100%', maxWidth: '600px', height: '180px' }} />
    </div>
  );
}

class ApplicationErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, details: ErrorInfo) {
    if (import.meta.env.DEV) console.error('render_failed', error, details);
  }

  render() {
    if (this.state.failed) {
      return <div className="fatal-error" role="alert"><AlertTriangle /><h1>Sayfa görüntülenemedi.</h1><p>Yerel kayıtlarınız silinmedi. Sayfayı yenileyip tekrar deneyin.</p><button className="button button-primary" onClick={() => window.location.reload()}>Sayfayı yenile</button></div>;
    }
    return this.props.children;
  }
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [pathname]);
  return null;
}

function RoutedApplication() {
  const { theme, toggleTheme } = useTheme();
  const { storageError } = useAppData();
  return (
    <AppShell theme={theme} onToggleTheme={toggleTheme}>
      <ScrollToTop />
      {storageError && <div className="global-storage-error" role="alert"><AlertTriangle size={18} /><span>{storageError}</span></div>}
      <Suspense fallback={<PageSuspenseFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tara" element={<ScannerPage />} />
          <Route path="/sonuclar" element={<ResultsPage />} />
          <Route path="/sonuclar/:sessionId" element={<ResultsPage />} />
          <Route path="/rehber" element={<GuidePage />} />
          <Route path="/ayarlar" element={<SettingsPage />} />
          <Route path="/gizlilik" element={<LegalPage />} />
          <Route path="/kvkk-aydinlatma" element={<LegalPage />} />
          <Route path="/kullanim-kosullari" element={<LegalPage />} />
          <Route path="/sorumluluk-reddi" element={<LegalPage />} />
          <Route path="/yerel-depolama" element={<LegalPage />} />
          <Route path="/cerez-politikasi" element={<LegalPage />} />
          <Route path="/acik-kaynak-lisanslari" element={<LegalPage />} />
          <Route path="/erisilebilirlik" element={<LegalPage />} />
          <Route path="/iletisim" element={<LegalPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

export default function App() {
  return (
    <ApplicationErrorBoundary>
      <BrowserRouter>
        <AppDataProvider><RoutedApplication /></AppDataProvider>
      </BrowserRouter>
    </ApplicationErrorBoundary>
  );
}
