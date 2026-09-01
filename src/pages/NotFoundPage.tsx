import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return <div className="page-section section-wrap empty-state"><span className="error-code">404</span><h1>Bu sayfa bulunamadı.</h1><p>Bağlantı değişmiş veya kaldırılmış olabilir.</p><Link className="button button-primary" to="/"><ArrowLeft size={17} /> Ana sayfaya dön</Link></div>;
}
