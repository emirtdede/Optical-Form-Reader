import { useEffect, useState, type ChangeEvent } from 'react';
import { AlertTriangle, Database, Download, HardDrive, Import, LockKeyhole, ShieldCheck, Trash2 } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { exportAllSessionsJson } from '../export/exporters';
import { importProcessingJobs, importSessions, listProcessingJobs } from '../storage/database';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function SettingsPage() {
  const { sessions, refresh, deleteAll } = useAppData();
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    async function inspectStorage() {
      try {
        const estimate = await navigator.storage?.estimate?.();
        if (estimate) setStorage({ usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 });
        if (navigator.storage?.persisted) setPersistent(await navigator.storage.persisted());
      } catch {
        setStorage(null);
      }
    }
    void inspectStorage();
  }, [sessions]);

  async function requestPersistence() {
    if (!navigator.storage?.persist) {
      setMessage({ type: 'error', text: 'Bu tarayıcı kalıcı depolama isteğini desteklemiyor.' });
      return;
    }
    try {
      const accepted = await navigator.storage.persist();
      setPersistent(accepted);
      setMessage({ type: accepted ? 'success' : 'error', text: accepted ? 'Tarayıcı kalıcı depolama izni verdi.' : 'Kalıcı depolama izni verilmedi; düzenli yedek almanız önerilir.' });
    } catch {
      setMessage({ type: 'error', text: 'Kalıcı depolama izni istenemedi. Tarayıcı ayarlarını kontrol edin.' });
    }
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Yedek dosyası 20 MB sınırını aşıyor.' });
      return;
    }
    try {
      const payload = JSON.parse(await file.text()) as { schemaVersion?: number; sessions?: unknown[]; jobs?: unknown[] };
      if (![1, 2].includes(payload.schemaVersion ?? 0) || !Array.isArray(payload.sessions)) throw new Error('Yedek biçimi tanınmadı.');
      const count = await importSessions(payload.sessions);
      if (!count) throw new Error('İçe aktarılabilir geçerli kayıt bulunamadı.');
      if (Array.isArray(payload.jobs)) await importProcessingJobs(payload.jobs);
      await refresh();
      setMessage({ type: 'success', text: `${count} değerlendirme içe aktarıldı.` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Yedek dosyası okunamadı.' });
    }
  }

  async function clearEverything() {
    if (!window.confirm('Tüm yerel değerlendirme kayıtları kalıcı olarak silinsin mi? Bu işlem geri alınamaz.')) return;
    try {
      await deleteAll();
      setMessage({ type: 'success', text: 'Tüm yerel değerlendirme kayıtları silindi.' });
    } catch {
      setMessage({ type: 'error', text: 'Yerel kayıtlar silinemedi. Tarayıcı depolama ayarlarını kontrol edin.' });
    }
  }

  async function exportBackup() {
    try {
      const allJobs = (await Promise.all(sessions.map((session) => listProcessingJobs(session.id)))).flat();
      exportAllSessionsJson(sessions, allJobs);
    } catch {
      setMessage({ type: 'error', text: 'Yedek dosyası hazırlanamadı.' });
    }
  }

  return (
    <div className="page-section section-wrap narrow-wrap settings-page">
      <header className="page-header"><span className="eyebrow"><Database size={15} /> Yerel veri yönetimi</span><h1>Kayıtlarınızın kontrolü sizde.</h1><p>Değerlendirme sonuçlarını yedekleyin, geri yükleyin veya bu tarayıcıdan tamamen silin.</p></header>
      {message && <div className={`notice notice-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}><AlertTriangle size={18} /><span>{message.text}</span></div>}

      <section className="storage-card">
        <div className="storage-card-icon"><HardDrive /></div>
        <div><h2>Tarayıcı depolaması</h2><p>{sessions.length} değerlendirme ve {sessions.reduce((sum, session) => sum + session.results.length, 0)} öğrenci kaydı bulunuyor.</p>
          {storage && <><div className="storage-meter"><span style={{ width: `${Math.min(100, storage.quota ? (storage.usage / storage.quota) * 100 : 0)}%` }} /></div><small>{formatBytes(storage.usage)} kullanılıyor · tahmini kota {formatBytes(storage.quota)}</small></>}
        </div>
        <span className={persistent ? 'status-pill success' : 'status-pill warning'}><span /> {persistent ? 'Kalıcı izin etkin' : 'Standart depolama'}</span>
      </section>

      <section className="settings-grid">
        <article><div className="feature-icon"><Download /></div><h2>Tüm verileri yedekle</h2><p>Değerlendirmeleri, cevap anahtarlarını, öğrenci sonuçlarını ve işlem manifestosunu tek JSON dosyasına kaydedin.</p><button className="button button-secondary" type="button" disabled={!sessions.length} onClick={() => void exportBackup()}>JSON yedeğini indir</button></article>
        <article><div className="feature-icon"><Import /></div><h2>Yedekten geri yükle</h2><p>Daha önce bu uygulamadan alınmış bir JSON yedeğini içe aktarın. Aynı kimlikli kayıtlar güncellenir.</p><label className="button button-secondary">Yedek dosyası seç<input type="file" accept="application/json,.json" onChange={(event) => void importBackup(event)} /></label></article>
        <article><div className="feature-icon"><ShieldCheck /></div><h2>Kalıcı depolama iste</h2><p>Desteklenen tarayıcılarda otomatik alan temizliğine karşı ek koruma talep edin. Bu yine de yedek yerine geçmez.</p><button className="button button-secondary" type="button" disabled={persistent === true} onClick={() => void requestPersistence()}>{persistent ? 'İzin etkin' : 'Kalıcı izin iste'}</button></article>
        <article className="danger-card"><div className="feature-icon"><Trash2 /></div><h2>Tüm kayıtları sil</h2><p>Bu tarayıcı profilindeki bütün değerlendirme sonuçlarını kalıcı olarak kaldırır.</p><button className="button button-danger" type="button" disabled={!sessions.length} onClick={() => void clearEverything()}>Tüm yerel veriyi sil</button></article>
      </section>

      <section className="local-data-note"><LockKeyhole /><div><h2>Neler saklanır?</h2><p>Cevap anahtarı, öğrenci numarası, işaretlenen seçenekler, puanlar, part ayarları ve işlem manifestosu IndexedDB içinde tutulur. Kaynak görüntü, PDF ve ZIP dosyaları hiçbir zaman kalıcı veritabanına yazılmaz.</p></div></section>
    </div>
  );
}
