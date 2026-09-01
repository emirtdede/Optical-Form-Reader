import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'optik-theme';

function preferredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Gizlilik ayarları localStorage erişimini engelleyebilir.
  }
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(preferredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Tema yine geçerli sekmede uygulanır; tercih kalıcılaştırılamaz.
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#0b1220' : '#f4f7fb',
    );
  }, [theme]);

  return { theme, toggleTheme: () => setTheme((current) => current === 'dark' ? 'light' : 'dark') };
}
