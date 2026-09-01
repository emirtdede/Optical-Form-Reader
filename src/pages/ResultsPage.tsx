import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, BarChart3, Check, ChevronRight, ClipboardList, Download, FileArchive,
  FileJson, FileSpreadsheet, FileText, Filter, Layers3, PencilLine, Printer, RotateCcw,
  Search, Sparkles, Trash2, TrendingUp, X,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { recalculateStudentAnswers } from '../domain/scoring';
import { applyRelativeGrading } from '../domain/grading';
import { calculateQuestionStatistics, calculateSessionSummary } from '../domain/statistics';
import {
  exportAnswerMatrixCsv, exportQuestionCsv, exportSessionJson, exportSessionPdf, exportStudentPdf,
  exportSummaryCsv, exportXlsx, exportZip, printSession,
} from '../export/exporters';
import { listProcessingJobs } from '../storage/database';
import {
  BOOKLETS, CHOICES, type AnswerChoice, type BookletType, type ExamSession, type ProcessingJob, type QuestionResult, type StudentResult,
} from '../types';

type ResultsTab = 'students' | 'questions' | 'jobs';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function ResultsPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { sessions, loading, saveStudentResult, deleteSession } = useAppData();
  const session = sessions.find((candidate) => candidate.id === sessionId) ?? sessions[0];
  const [tab, setTab] = useState<ResultsTab>('students');
  const [search, setSearch] = useState('');
  const [bookletFilter, setBookletFilter] = useState<'all' | BookletType>('all');
  const [useRelativeGrading, setUseRelativeGrading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [busyExport, setBusyExport] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [visibleStudentCount, setVisibleStudentCount] = useState(250);
  const [visibleJobCount, setVisibleJobCount] = useState(250);

  useEffect(() => {
    setSelectedStudentId(null);
    setSearch('');
    setBookletFilter('all');
    setTab('students');
    setUseRelativeGrading(Boolean(session?.useRelativeGrading));
    setVisibleStudentCount(250);
    setVisibleJobCount(250);
    let active = true;
    if (session?.id) void listProcessingJobs(session.id).then((storedJobs) => {
      if (active) setJobs(storedJobs);
    }).catch(() => {
      if (active) setJobs([]);
    });
    else setJobs([]);
    return () => { active = false; };
  }, [session?.id]);

  useEffect(() => {
    setVisibleStudentCount(250);
  }, [search, bookletFilter]);

  // Çan Eğrisi (T-Skor Bağıl Değerlendirme)
  const { gradedResults, relativeReport } = useMemo(() => {
    if (!session) return { gradedResults: [], relativeReport: null };
    if (useRelativeGrading) {
      const { results, report } = applyRelativeGrading(session.results);
      return { gradedResults: results, relativeReport: report };
    }
    return { gradedResults: session.results, relativeReport: null };
  }, [session, useRelativeGrading]);

  const activeSession: ExamSession = useMemo(() => {
    if (!session) return session;
    return {
      ...session,
      results: gradedResults,
      useRelativeGrading,
    };
  }, [session, gradedResults, useRelativeGrading]);

  const summary = useMemo(() => activeSession ? calculateSessionSummary(activeSession) : null, [activeSession]);
  const questionStats = useMemo(() => activeSession ? calculateQuestionStatistics(activeSession) : [], [activeSession]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    return gradedResults.filter((result) => {
      if (bookletFilter !== 'all' && (result.booklet ?? 'A') !== bookletFilter) return false;
      if (!query) return true;
      return result.studentNumber.toLocaleLowerCase('tr-TR').includes(query) || result.sourceName.toLocaleLowerCase('tr-TR').includes(query);
    });
  }, [search, bookletFilter, gradedResults]);

  const selectedStudent = gradedResults.find((result) => result.id === selectedStudentId) ?? null;
  const partIndexes = useMemo(
    () => activeSession ? [...new Set(activeSession.results.map((result) => result.partIndex ?? 0))].sort((left, right) => left - right) : [],
    [activeSession],
  );

  async function runExport(name: string, callback: () => void | Promise<void>) {
    try {
      setNotice(null);
      setBusyExport(name);
      await callback();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Dosya oluşturulamadı.');
    } finally {
      setBusyExport(null);
    }
  }

  async function handleDelete() {
    if (!session || !window.confirm(`“${session.title}” kaydını kalıcı olarak silmek istiyor musunuz?`)) return;
    try {
      await deleteSession(session.id);
      navigate('/sonuclar');
    } catch {
      setNotice('Değerlendirme silinemedi. Tarayıcı depolama ayarlarını kontrol edin.');
    }
  }

  async function saveStudent(updated: StudentResult) {
    if (!session) return;
    const duplicate = session.results.some((result) => result.id !== updated.id && result.studentNumber === updated.studentNumber);
    if (duplicate) throw new Error('Bu öğrenci numarası aynı değerlendirmede zaten kullanılıyor.');
    await saveStudentResult(session.id, updated, new Date().toISOString());
    setSelectedStudentId(null);
  }

  if (loading) return <div className="page-section section-wrap empty-state"><div className="skeleton-card" /><p>Yerel kayıtlar okunuyor…</p></div>;
  if (!session || !summary || !activeSession) {
    return (
      <div className="page-section section-wrap empty-state">
        <div className="empty-icon"><ClipboardList /></div><h1>Henüz kayıtlı sonuç yok.</h1><p>İlk cevap anahtarınızı ve öğrenci formlarını ekleyerek bir değerlendirme oluşturun.</p><Link className="button button-primary" to="/tara">İlk taramayı başlat <ChevronRight size={18} /></Link>
      </div>
    );
  }

  const topWrong = [...questionStats].sort((a, b) => b.wrongRate - a.wrongRate).slice(0, 5);
  const topBlank = [...questionStats].sort((a, b) => b.blankRate - a.blankRate).slice(0, 5);

  function partSession(partIndex: number): ExamSession {
    return {
      ...activeSession,
      title: `${activeSession.title} - Part ${partIndex + 1}`,
      results: activeSession.results.filter((result) => (result.partIndex ?? 0) === partIndex),
    };
  }

  return (
    <div className="page-section section-wrap results-layout">
      <aside className="session-sidebar">
        <div className="sidebar-heading"><span>Kayıtlar</span><strong>{sessions.length}</strong></div>
        <div className="session-list">
          {sessions.map((candidate) => (
            <Link key={candidate.id} to={`/sonuclar/${candidate.id}`} className={candidate.id === session.id ? 'session-item is-active' : 'session-item'}>
              <span className="session-icon"><FileText size={18} /></span><span><strong>{candidate.title}</strong><small>{candidate.results.length} öğrenci · {formatDate(candidate.updatedAt)}</small></span><ChevronRight size={16} />
            </Link>
          ))}
        </div>
      </aside>

      <div className="results-content">
        <header className="result-header">
          <div>
            <span className="eyebrow">Değerlendirme raporu</span>
            <h1>{activeSession.title}</h1>
            <p>{formatDate(activeSession.createdAt)} · Algoritma {activeSession.algorithmVersion} {activeSession.sections && activeSession.sections.length > 0 ? `· ${activeSession.sections.length} Bölüm Tanımlı` : ''}</p>
          </div>
          <div className="header-action-group">
            <button
              type="button"
              className={`button ${useRelativeGrading ? 'button-secondary' : 'button-ghost'}`}
              onClick={() => setUseRelativeGrading(!useRelativeGrading)}
              title="YÖK standart T-Skor çan eğrisi bağıl değerlendirmesini açar/kapatır"
            >
              <TrendingUp size={16} />
              <span>Çan Eğrisi: {useRelativeGrading ? 'Aktif' : 'Pasif'}</span>
            </button>
            <button className="icon-button danger-outline" type="button" onClick={() => void handleDelete()} aria-label="Değerlendirmeyi sil"><Trash2 size={19} /></button>
          </div>
        </header>

        {notice && <div className="notice notice-error" role="alert"><AlertTriangle size={18} /><span>{notice}</span><button type="button" onClick={() => setNotice(null)}><X size={17} /></button></div>}

        {activeSession.progress && (
          <section className={`session-progress-card status-${activeSession.progress.status}`}>
            <Layers3 />
            <div><strong>{activeSession.progress.status === 'completed' ? 'İşlem tamamlandı' : 'Kesintiye dayanıklı kayıt aktif'}</strong><span>{activeSession.progress.completed} kayıt · {activeSession.progress.skipped} atlandı · {activeSession.progress.failed} hata · {activeSession.progress.partCount} part</span></div>
            <span className="status-pill">{activeSession.progress.status === 'completed' ? 'Tamamlandı' : activeSession.progress.status === 'interrupted' ? 'Devam edilebilir' : 'İşleniyor'}</span>
          </section>
        )}

        {/* Çan Eğrisi Bilgilendirme Kartı */}
        {useRelativeGrading && relativeReport && (
          <section className="recommendation-card bell-curve-summary-card" aria-live="polite">
            <div className="recommendation-icon"><TrendingUp /></div>
            <div>
              <span className="eyebrow">YÖK Bağıl Değerlendirme Sistemi (BDS)</span>
              <h2>Çan Eğrisi (T-Skoru Modeli) Uygulandı</h2>
              <p>
                Sınıf Ortalaması (&mu;): <strong>{relativeReport.mean}</strong> · Standart Sapma (&sigma;): <strong>{relativeReport.standardDeviation}</strong> · En Düşük Puan: <strong>{relativeReport.minScore}</strong> · En Yüksek Puan: <strong>{relativeReport.maxScore}</strong> ({relativeReport.studentCount} Öğrenci)
              </p>
            </div>
          </section>
        )}

        <section className="metric-grid">
          <article><span>Öğrenci</span><strong>{summary.studentCount}</strong><small>başarıyla okundu</small></article>
          <article><span>Ortalama</span><strong>%{summary.average}</strong><small>medyan %{summary.median}</small></article>
          <article><span>En yüksek</span><strong>%{summary.maximum}</strong><small>en düşük %{summary.minimum}</small></article>
          <article><span>Standart sapma</span><strong>{summary.standardDeviation}</strong><small>puan dağılımı</small></article>
        </section>

        <section className="export-panel">
          <div><h2>Dışa aktar</h2><p>İhtiyacınız olan görünümü tek dosya veya paket olarak alın.</p></div>
          <div className="export-actions">
            <button type="button" disabled={Boolean(busyExport)} onClick={() => void runExport('xlsx', () => exportXlsx(activeSession))}><FileSpreadsheet /> XLSX</button>
            <button type="button" onClick={() => exportSummaryCsv(activeSession)}><FileText /> Özet CSV</button>
            <button type="button" onClick={() => exportAnswerMatrixCsv(activeSession)}><FileText /> Cevap matrisi</button>
            <button type="button" onClick={() => exportQuestionCsv(activeSession)}><BarChart3 /> Soru CSV</button>
            <button type="button" disabled={Boolean(busyExport)} onClick={() => void runExport('pdf', () => exportSessionPdf(activeSession))}><Download /> PDF</button>
            <button type="button" onClick={() => exportSessionJson(activeSession, jobs)}><FileJson /> JSON</button>
            <button type="button" disabled={Boolean(busyExport)} onClick={() => void runExport('zip', () => exportZip(activeSession, jobs))}><FileArchive /> Tümünü ZIP</button>
            <button type="button" onClick={() => void runExport('print', () => printSession(activeSession))}><Printer /> Yazdır</button>
          </div>
          {partIndexes.length > 0 && <div className="part-export-row"><span>Part paketleri</span>{partIndexes.map((partIndex) => <button type="button" key={partIndex} disabled={Boolean(busyExport)} onClick={() => void runExport(`part-${partIndex}`, () => exportZip(partSession(partIndex), jobs.filter((job) => job.partIndex === partIndex), `part-${partIndex + 1}`))}><FileArchive size={15} /> Part {partIndex + 1}</button>)}</div>}
        </section>

        <div className="tab-bar" role="tablist" aria-label="Sonuç görünümü">
          <button role="tab" aria-selected={tab === 'students'} className={tab === 'students' ? 'is-active' : ''} onClick={() => setTab('students')}>Öğrenci sonuçları</button>
          <button role="tab" aria-selected={tab === 'questions'} className={tab === 'questions' ? 'is-active' : ''} onClick={() => setTab('questions')}>Soru istatistikleri</button>
          {jobs.length > 0 && <button role="tab" aria-selected={tab === 'jobs'} className={tab === 'jobs' ? 'is-active' : ''} onClick={() => setTab('jobs')}>İşlem manifestosu</button>}
        </div>

        {tab === 'students' ? (
          <section className="data-panel">
            <div className="panel-tools">
              <div className="search-field"><Search size={17} /><input aria-label="Öğrenci ara" placeholder="Öğrenci no veya dosya ara" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
              <div className="booklet-filter-group" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Kitapçık:</span>
                <select
                  value={bookletFilter}
                  onChange={(e) => setBookletFilter(e.target.value as any)}
                  className="booklet-filter-select"
                  aria-label="Kitapçık filtresi"
                >
                  <option value="all">Tüm Kitapçıklar</option>
                  <option value="A">A Kitapçığı</option>
                  <option value="B">B Kitapçığı</option>
                  <option value="C">C Kitapçığı</option>
                  <option value="D">D Kitapçığı</option>
                </select>
              </div>
              <span>{filteredStudents.length} kayıt {useRelativeGrading ? '(Çan Eğrisi Aktif)' : ''}</span>
            </div>
            <div className="table-scroll">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Öğrenci no</th>
                    <th>Kitapçık</th>
                    <th>Dosya</th>
                    <th>Doğru</th>
                    <th>Yanlış</th>
                    <th>Boş</th>
                    <th>Net</th>
                    <th>100 Puan</th>
                    <th>4.00 GPA</th>
                    <th>Harf Notu</th>
                    {useRelativeGrading && <th>Çan Harfi (T)</th>}
                    <th><span className="sr-only">İşlemler</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.slice(0, visibleStudentCount).map((student) => (
                    <tr key={student.id} className={student.studentNumberNeedsReview || student.bookletNeedsReview ? 'needs-review' : ''}>
                      <td><strong>{student.studentNumber}</strong>{student.studentNumberNeedsReview && <span className="review-badge"><AlertTriangle size={13} /> Kontrol</span>}</td>
                      <td>
                        <span className={`booklet-chip booklet-${student.booklet ?? 'A'}`}>{student.booklet ?? 'A'}</span>
                        {student.bookletNeedsReview && <span className="review-badge" title="Kitapçık kontrolü gerekli"><AlertTriangle size={12} /></span>}
                      </td>
                      <td>{student.sourceName}</td>
                      <td className="text-success">{student.score.correct}</td>
                      <td className="text-danger">{student.score.wrong}</td>
                      <td>{student.score.blank}</td>
                      <td><strong>{student.score.net}</strong></td>
                      <td>
                        <div className="inline-rate">
                          <span style={{ width: `${student.score.score100 ?? student.score.percentage}%` }} />
                          <strong>%{student.score.score100 ?? student.score.percentage}</strong>
                        </div>
                      </td>
                      <td><strong>{student.score.gpa4 ?? 0}</strong></td>
                      <td>
                        <span className={`letter-grade-badge grade-${student.score.letterGrade ?? 'FF'}`}>
                          {student.score.letterGrade ?? 'FF'}
                        </span>
                      </td>
                      {useRelativeGrading && (
                        <td>
                          <span className={`letter-grade-badge grade-${student.score.relativeGrade ?? 'FF'}`} title={`T-Skoru: ${student.score.tScore ?? ''}`}>
                            {student.score.relativeGrade ?? 'FF'} <small style={{ marginLeft: 3, opacity: 0.8 }}>({student.score.tScore ?? '-'})</small>
                          </span>
                        </td>
                      )}
                      <td>
                        <button className="row-action" type="button" onClick={() => setSelectedStudentId(student.id)}>
                          <PencilLine size={16} /> İncele
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visibleStudentCount < filteredStudents.length && <button className="button button-ghost table-more" type="button" onClick={() => setVisibleStudentCount((current) => current + 250)}>Sonraki 250 öğrenciyi göster</button>}
          </section>
        ) : tab === 'questions' ? (
          <section className="question-analysis">
            <div className="ranking-grid">
              <RankingCard title="En çok yanlış yapılan" items={topWrong.map((item) => ({ question: item.question, rate: item.wrongRate, count: item.wrong }))} tone="wrong" />
              <RankingCard title="En çok boş bırakılan" items={topBlank.map((item) => ({ question: item.question, rate: item.blankRate, count: item.blank }))} tone="blank" />
            </div>
            <div className="data-panel">
              <div className="panel-tools"><div><h2>Tüm soru istatistikleri</h2><p>Güçlük değeri 1'e yaklaştıkça soru daha kolaydır.</p></div><span><Filter size={15} /> 100 soru</span></div>
              <div className="table-scroll"><table className="question-table"><thead><tr><th>Soru</th><th>Anahtar</th><th>Doğru</th><th>Yanlış</th><th>Boş</th><th>Belirsiz</th><th>Dağılım</th><th>Güçlük</th></tr></thead><tbody>{questionStats.map((item) => <tr key={item.question}><td><strong>{item.question}</strong></td><td><span className="answer-key-chip">{item.key}</span></td><td className="text-success">{item.correct} <small>%{item.correctRate}</small></td><td className="text-danger">{item.wrong} <small>%{item.wrongRate}</small></td><td>{item.blank} <small>%{item.blankRate}</small></td><td>{item.ambiguous}</td><td><div className="option-distribution">{CHOICES.map((choice) => <span key={choice} title={`${choice}: ${item.optionCounts[choice]}`} style={{ flex: Math.max(0.25, item.optionCounts[choice]) }}>{choice}</span>)}</div></td><td><div className="difficulty-meter"><span style={{ width: `${item.difficulty * 100}%` }} /><strong>{item.difficulty.toFixed(2)}</strong></div></td></tr>)}</tbody></table></div>
            </div>
          </section>
        ) : (
          <section className="data-panel">
            <div className="panel-tools"><div><h2>İşlenen kaynaklar</h2><p>Tamamlanan, atlanan ve okunamayan her kaynak bu listede izlenir.</p></div><span>{jobs.length} iş</span></div>
            <div className="table-scroll"><table><thead><tr><th>Kaynak</th><th>Part</th><th>Durum</th><th>Öğrenci no</th><th>Açıklama</th><th>Güncelleme</th></tr></thead><tbody>{jobs.slice(0, visibleJobCount).map((job) => <tr key={job.id}><td><strong>{job.sourceName}</strong></td><td>{job.partIndex + 1}</td><td><span className={`job-status status-${job.status}`}>{job.status === 'completed' ? 'Tamamlandı' : job.status === 'skipped' ? 'Atlandı' : job.status === 'error' ? 'Okunamadı' : 'Bekliyor'}</span></td><td>{job.studentNumber ?? '—'}</td><td>{job.error ?? '—'}</td><td>{formatDate(job.updatedAt)}</td></tr>)}</tbody></table></div>
            {visibleJobCount < jobs.length && <button className="button button-ghost table-more" type="button" onClick={() => setVisibleJobCount((current) => current + 250)}>Sonraki 250 işi göster</button>}
          </section>
        )}
      </div>

      {selectedStudent && (
        <StudentReview
          session={activeSession}
          student={selectedStudent}
          onClose={() => setSelectedStudentId(null)}
          onSave={saveStudent}
          onPdf={() => void runExport('student-pdf', () => exportStudentPdf(activeSession, selectedStudent))}
        />
      )}
    </div>
  );
}

function RankingCard({ title, items, tone }: { title: string; items: Array<{ question: number; rate: number; count: number }>; tone: 'wrong' | 'blank' }) {
  return <article className={`ranking-card tone-${tone}`}><h2>{title}</h2><div>{items.map((item, index) => <div className="ranking-row" key={item.question}><span className="rank">{index + 1}</span><strong>{item.question}. soru</strong><div className="rank-bar"><span style={{ width: `${item.rate}%` }} /></div><span>%{item.rate}</span><small>{item.count} öğrenci</small></div>)}</div></article>;
}

function StudentReview({ session, student, onClose, onSave, onPdf }: { session: ExamSession; student: StudentResult; onClose: () => void; onSave: (student: StudentResult) => Promise<void>; onPdf: () => void }) {
  const [studentNumber, setStudentNumber] = useState(student.studentNumber);
  const [booklet, setBooklet] = useState<BookletType>(student.booklet ?? 'A');
  const [answers, setAnswers] = useState<QuestionResult[]>(student.answers);
  const [filter, setFilter] = useState<'all' | 'wrong' | 'blank' | 'ambiguous'>('all');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') onClose(); }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  function handleBookletChange(nextBooklet: BookletType) {
    setBooklet(nextBooklet);
    const targetKey = session.bookletKeys?.[nextBooklet] ?? (nextBooklet === 'A' ? session.answerKey : null);
    if (targetKey && targetKey.length === 100) {
      setAnswers((current) => current.map((ans, idx) => {
        const key = targetKey[idx];
        const marked = ans.marked;
        let status: QuestionResult['status'];
        if (ans.status === 'ambiguous') status = 'ambiguous';
        else if (marked === null) status = 'blank';
        else if (marked === key) status = 'correct';
        else status = 'wrong';
        return { ...ans, key, status };
      }));
    }
  }

  const recalculated = useMemo(() => recalculateStudentAnswers(answers, session.sections), [answers, session.sections]);
  const visibleAnswers = filter === 'all' ? answers : answers.filter((answer) => answer.status === filter);

  function updateAnswer(question: number, marked: AnswerChoice | null) {
    setAnswers((current) => current.map((answer) => answer.question === question ? {
      ...answer,
      marked,
      status: marked === null ? 'blank' : marked === answer.key ? 'correct' : 'wrong',
      confidence: 1,
    } : answer));
  }

  async function submit() {
    const normalizedNumber = studentNumber.replace(/\s+/g, '').slice(0, 24);
    if (!/^[A-Za-z0-9_-]{3,24}$/.test(normalizedNumber)) {
      setError('Öğrenci numarası 3–24 harf, rakam, tire veya alt çizgi içermelidir.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await onSave({
        ...student,
        studentNumber: normalizedNumber,
        booklet,
        bookletNeedsReview: false,
        studentNumberSource: 'manual',
        studentNumberNeedsReview: false,
        answers: recalculated.answers,
        score: recalculated.score,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Değişiklikler kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="review-drawer" role="dialog" aria-modal="true" aria-labelledby="review-title">
        <header>
          <div>
            <span className="eyebrow">Öğrenci karnesi ve inceleme</span>
            <h2 id="review-title">{student.studentNumber}</h2>
            <p>{session.title}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="İncelemeyi kapat"><X /></button>
        </header>

        {/* 3'lü Not & Genel Puan Özeti */}
        <div className="review-summary">
          <div><span>Doğru</span><strong className="text-success">{recalculated.score.correct}</strong></div>
          <div><span>Yanlış</span><strong className="text-danger">{recalculated.score.wrong}</strong></div>
          <div><span>Boş</span><strong>{recalculated.score.blank}</strong></div>
          <div><span>Toplam Net</span><strong>{recalculated.score.net}</strong></div>
        </div>

        <div className="review-summary review-grades-summary">
          <div><span>100'lük Not</span><strong>%{recalculated.score.score100}</strong></div>
          <div><span>4.00 GPA</span><strong>{recalculated.score.gpa4}</strong></div>
          <div><span>Harf Notu</span><span className={`letter-grade-badge grade-${recalculated.score.letterGrade}`}>{recalculated.score.letterGrade}</span></div>
          {student.score.relativeGrade && (
            <div><span>Çan Harfi (T-Skor)</span><span className={`letter-grade-badge grade-${student.score.relativeGrade}`}>{student.score.relativeGrade} ({student.score.tScore})</span></div>
          )}
        </div>

        {/* Ders / Bölüm Kırılımı Tablosu */}
        {recalculated.score.sections && recalculated.score.sections.length > 0 && (
          <div className="review-sections-panel">
            <h4>Ders &amp; Bölüm Kırılımı</h4>
            <div className="table-scroll">
              <table className="review-sections-table">
                <thead>
                  <tr>
                    <th>Bölüm</th>
                    <th>Aralık</th>
                    <th>D</th>
                    <th>Y</th>
                    <th>B</th>
                    <th>Net</th>
                    <th>100'lük</th>
                    <th>Harf</th>
                  </tr>
                </thead>
                <tbody>
                  {recalculated.score.sections.map((sec) => (
                    <tr key={sec.sectionId}>
                      <td><strong>{sec.name}</strong></td>
                      <td>{sec.startQuestion}–{sec.endQuestion}</td>
                      <td className="text-success">{sec.correct}</td>
                      <td className="text-danger">{sec.wrong}</td>
                      <td>{sec.blank}</td>
                      <td><strong>{sec.net}</strong></td>
                      <td>%{sec.score100}</td>
                      <td><span className={`letter-grade-badge grade-${sec.letterGrade}`}>{sec.letterGrade}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="student-edit-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 12, marginBottom: 16 }}>
          <div className="student-number-edit" style={{ margin: 0 }}>
            <label htmlFor="student-number">Öğrenci numarası</label>
            <input id="student-number" value={studentNumber} maxLength={24} onChange={(event) => setStudentNumber(event.target.value)} />
            <small>Kaynak: {student.studentNumberSource === 'form' ? 'form baloncukları' : student.studentNumberSource === 'filename' ? 'dosya adı' : student.studentNumberSource === 'manual' ? 'manuel' : 'geçici numara'}</small>
          </div>
          <div className="booklet-edit" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="student-booklet" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Kitapçık</label>
            <select
              id="student-booklet"
              value={booklet}
              onChange={(e) => handleBookletChange(e.target.value as BookletType)}
              style={{ height: 42, borderRadius: 8, padding: '0 10px', background: 'var(--surface-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: 600 }}
            >
              {BOOKLETS.map((b) => (
                <option key={b} value={b}>{b} Kitapçığı</option>
              ))}
            </select>
            <small style={{ color: student.bookletNeedsReview ? 'var(--warning-color, #eab308)' : 'var(--text-muted)' }}>
              {student.bookletNeedsReview ? 'Kontrol gerekli' : 'Kitapçık türü'}
            </small>
          </div>
        </div>

        <div className="answer-filters">
          <button className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>Tümü</button>
          <button className={filter === 'wrong' ? 'is-active' : ''} onClick={() => setFilter('wrong')}>Yanlış</button>
          <button className={filter === 'blank' ? 'is-active' : ''} onClick={() => setFilter('blank')}>Boş</button>
          <button className={filter === 'ambiguous' ? 'is-active' : ''} onClick={() => setFilter('ambiguous')}>Belirsiz</button>
        </div>

        <div className="answer-review-list">
          {visibleAnswers.map((answer) => (
            <div className={`answer-review-row status-${answer.status}`} key={answer.question}>
              <strong>{answer.question}</strong>
              <span className="key-note">Anahtar {answer.key}</span>
              <div>
                {CHOICES.map((choice) => (
                  <button key={choice} type="button" className={answer.marked === choice ? 'is-selected' : ''} onClick={() => updateAnswer(answer.question, choice)} aria-label={`${answer.question}. soruyu ${choice} olarak işaretle`}>
                    {choice}
                  </button>
                ))}
                <button type="button" className={answer.marked === null ? 'is-selected' : ''} onClick={() => updateAnswer(answer.question, null)} aria-label={`${answer.question}. soruyu boş olarak işaretle`}>
                  —
                </button>
              </div>
            </div>
          ))}
        </div>

        {error && <div className="field-error"><AlertTriangle size={16} /> {error}</div>}

        <footer>
          <button type="button" className="button button-ghost" onClick={onPdf}><Download size={17} /> Öğrenci PDF</button>
          <button type="button" className="button button-primary" disabled={saving} onClick={() => void submit()}><Check size={17} /> {saving ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}</button>
        </footer>
      </aside>
    </div>
  );
}
