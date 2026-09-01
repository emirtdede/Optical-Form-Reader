import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { BarChart3, BookOpen, Menu, Moon, ScanLine, Settings, Sun, X } from 'lucide-react';
import { PRODUCT_NAME } from '../constants';
import type { Theme } from '../hooks/useTheme';
import { ProductMark } from './Brand';
import { Footer } from './Footer';

const navigation = [
  { to: '/tara', label: 'Form Tara', icon: ScanLine },
  { to: '/sonuclar', label: 'Sonuçlar', icon: BarChart3 },
  { to: '/rehber', label: 'Rehber', icon: BookOpen },
  { to: '/ayarlar', label: 'Veriler', icon: Settings },
];

export function AppShell({ children, theme, onToggleTheme }: { children: ReactNode; theme: Theme; onToggleTheme: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="site-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand-link" aria-label={`${PRODUCT_NAME} ana sayfa`} onClick={() => setMobileOpen(false)}>
            <ProductMark className="brand-mark" />
            <span>{PRODUCT_NAME}</span>
          </Link>
          <nav className={mobileOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Ana navigasyon">
            {navigation.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => isActive ? 'nav-link is-active' : 'nav-link'}>
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="topbar-actions">
            <button className="icon-button" type="button" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}>
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="icon-button mobile-menu-button" type="button" onClick={() => setMobileOpen((value) => !value)} aria-expanded={mobileOpen} aria-label="Menüyü aç veya kapat">
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>
      <main id="main-content">{children}</main>
      <Footer />
    </div>
  );
}
