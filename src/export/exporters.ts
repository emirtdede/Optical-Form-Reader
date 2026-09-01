import { calculateQuestionStatistics, calculateSessionSummary } from '../domain/statistics';
import type { ExamSession, ProcessingJob, StudentResult } from '../types';

const CSV_SEPARATOR = ';';

function safeSpreadsheetCell(value: unknown): string {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value: unknown): string {
  const text = safeSpreadsheetCell(value).replaceAll('"', '""');
  return `"${text}"`;
}

function toCsv(rows: unknown[][]): string {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(CSV_SEPARATOR)).join('\r\n')}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function filenameBase(session: ExamSession): string {
  return session.title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'optik-sonuclari';
}

export function summaryRows(session: ExamSession): unknown[][] {
  const sections: Array<{ name: string; id?: string; sectionId?: string }> =
    session.sections && session.sections.length > 0
      ? session.sections
      : (session.results[0]?.score.sections ?? []);

  const sectionHeaders = sections.flatMap((sec) => [
    `${sec.name} D`,
    `${sec.name} Y`,
    `${sec.name} B`,
    `${sec.name} Net`,
  ]);

  const headers = [
    'Öğrenci No',
    'Kitapçık',
    'Part',
    'Dosya',
    'Doğru',
    'Yanlış',
    'Boş',
    'Belirsiz',
    'Net',
    '100 Puan',
    '4.00 GPA',
    'Harf Notu',
    'Çan Eğrisi Harfi (T-Skor)',
    ...sectionHeaders,
    'Kimlik Kaynağı',
  ];

  const rows = session.results.map((result) => {
    const studentSections = result.score.sections ?? [];
    const sectionValues: unknown[] = sections.flatMap((sec) => {
      const secId = sec.id ?? sec.sectionId;
      const match = studentSections.find((s) => (secId && s.sectionId === secId) || s.name === sec.name);
      return [
        match ? match.correct : '-',
        match ? match.wrong : '-',
        match ? match.blank : '-',
        match ? match.net : '-',
      ];
    });

    const tScoreText = result.score.relativeGrade
      ? `${result.score.relativeGrade} (T: ${result.score.tScore ?? ''})`
      : '-';

    return [
      result.studentNumber,
      result.booklet ?? 'A',
      (result.partIndex ?? 0) + 1,
      result.sourceName,
      result.score.correct,
      result.score.wrong,
      result.score.blank,
      result.score.ambiguous,
      result.score.net,
      result.score.score100 ?? result.score.percentage,
      result.score.gpa4 ?? 0,
      result.score.letterGrade ?? 'FF',
      tScoreText,
      ...sectionValues,
      result.studentNumberSource,
    ];
  });

  return [headers, ...rows];
}

export function answerMatrixRows(session: ExamSession): unknown[][] {
  return [
    ['Öğrenci No', ...session.answerKey.map((_, index) => `S${index + 1}`)],
    ...session.results.map((result) => [
      result.studentNumber,
      ...result.answers.map((answer) => answer.marked ?? (answer.status === 'ambiguous' ? 'Çift' : 'Boş')),
    ]),
    ['Cevap Anahtarı', ...session.answerKey],
  ];
}

export function questionRows(session: ExamSession): unknown[][] {
  return [
    ['Soru', 'Anahtar', 'Doğru', 'Yanlış', 'Boş', 'Belirsiz', 'Doğru %', 'Yanlış %', 'Boş %', 'Güçlük'],
    ...calculateQuestionStatistics(session).map((statistic) => [
      statistic.question,
      statistic.key,
      statistic.correct,
      statistic.wrong,
      statistic.blank,
      statistic.ambiguous,
      statistic.correctRate,
      statistic.wrongRate,
      statistic.blankRate,
      statistic.difficulty,
    ]),
  ];
}

export function exportSummaryCsv(session: ExamSession) {
  downloadBlob(new Blob([toCsv(summaryRows(session))], { type: 'text/csv;charset=utf-8' }), `${filenameBase(session)}-ogrenci-ozeti.csv`);
}

export function exportAnswerMatrixCsv(session: ExamSession) {
  downloadBlob(new Blob([toCsv(answerMatrixRows(session))], { type: 'text/csv;charset=utf-8' }), `${filenameBase(session)}-cevap-matrisi.csv`);
}

export function exportQuestionCsv(session: ExamSession) {
  downloadBlob(new Blob([toCsv(questionRows(session))], { type: 'text/csv;charset=utf-8' }), `${filenameBase(session)}-soru-istatistikleri.csv`);
}

export function exportSessionJson(session: ExamSession, jobs: ProcessingJob[] = []) {
  downloadBlob(
    new Blob([JSON.stringify({ schemaVersion: 2, exportedAt: new Date().toISOString(), sessions: [session], jobs }, null, 2)], { type: 'application/json' }),
    `${filenameBase(session)}-yedek.json`,
  );
}

export function exportAllSessionsJson(sessions: ExamSession[], jobs: ProcessingJob[] = []) {
  downloadBlob(
    new Blob([JSON.stringify({ schemaVersion: 2, exportedAt: new Date().toISOString(), sessions, jobs }, null, 2)], { type: 'application/json' }),
    `optik-form-okuyucu-yedek-${new Date().toISOString().slice(0, 10)}.json`,
  );
}

function addWorksheetRows(worksheet: any, rows: unknown[][]) {
  rows.forEach((row) => worksheet.addRow(row.map((cell) => typeof cell === 'string' ? safeSpreadsheetCell(cell) : cell)));
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.columns.forEach((column: any, index: number) => {
    column.width = index < 2 ? 18 : 12;
  });
  worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length, column: rows[0].length } };
}

export async function exportXlsx(session: ExamSession) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Optik Form Okuyucu - Vellium';
  workbook.created = new Date(session.createdAt);
  addWorksheetRows(workbook.addWorksheet('Öğrenci Özeti'), summaryRows(session));
  addWorksheetRows(workbook.addWorksheet('Cevap Matrisi'), answerMatrixRows(session));
  addWorksheetRows(workbook.addWorksheet('Soru İstatistikleri'), questionRows(session));
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${filenameBase(session)}.xlsx`,
  );
}

function pdfText(value: string): string {
  return value
    .replaceAll('ı', 'i').replaceAll('İ', 'I')
    .replaceAll('ş', 's').replaceAll('Ş', 'S')
    .replaceAll('ğ', 'g').replaceAll('Ğ', 'G')
    .replaceAll('ü', 'u').replaceAll('Ü', 'U')
    .replaceAll('ö', 'o').replaceAll('Ö', 'O')
    .replaceAll('ç', 'c').replaceAll('Ç', 'C');
}

export async function exportSessionPdf(session: ExamSession) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const documentPdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const summary = calculateSessionSummary(session);
  documentPdf.setFontSize(18);
  documentPdf.text(pdfText(session.title), 14, 16);
  documentPdf.setFontSize(9);
  documentPdf.text(
    pdfText(`${summary.studentCount} ogrenci | Ortalama ${summary.average}% | Medyan ${summary.median}% | Standart sapma ${summary.standardDeviation}`),
    14,
    23,
  );
  autoTable(documentPdf, {
    startY: 28,
    head: [['Ogrenci No', 'Dogru', 'Yanlis', 'Bos', 'Net', '100 Puan', '4.00 GPA', 'Harf Notu', 'Can Harfi (T)']],
    body: session.results.map((result) => [
      pdfText(result.studentNumber),
      result.score.correct,
      result.score.wrong,
      result.score.blank,
      result.score.net,
      `%${result.score.score100 ?? result.score.percentage}`,
      result.score.gpa4 ?? 0,
      result.score.letterGrade ?? 'FF',
      result.score.relativeGrade ? `${result.score.relativeGrade} (${result.score.tScore ?? ''})` : '-',
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 118, 110] },
  });
  documentPdf.save(`${filenameBase(session)}-rapor.pdf`);
}

export async function exportStudentPdf(session: ExamSession, student: StudentResult) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const documentPdf = new jsPDF({ unit: 'mm', format: 'a4' });
  documentPdf.setFontSize(16);
  documentPdf.text(pdfText(`${session.title} - Ogrenci Karnesi: ${student.studentNumber}`), 14, 16);
  documentPdf.setFontSize(9);
  documentPdf.text(
    pdfText(`Kitapcik: ${student.booklet ?? 'A'} | Genel Toplam: Dogru ${student.score.correct} | Yanlis ${student.score.wrong} | Bos ${student.score.blank} | Net ${student.score.net} | 100 Puan: %${student.score.score100 ?? student.score.percentage} | GPA: ${student.score.gpa4 ?? '-'} | Harf: ${student.score.letterGrade ?? '-'}`),
    14,
    23,
  );

  let currentY = 28;

  // Ders / Bölüm Bazlı Karne Tablosu
  if (student.score.sections && student.score.sections.length > 0) {
    autoTable(documentPdf, {
      startY: currentY,
      head: [['Ders / Bolum', 'Soru Araligi', 'Dogru', 'Yanlis', 'Bos', 'Net', '100 Puan', 'Harf']],
      body: student.score.sections.map((sec) => [
        pdfText(sec.name),
        `${sec.startQuestion}-${sec.endQuestion}`,
        sec.correct,
        sec.wrong,
        sec.blank,
        sec.net,
        `%${sec.score100}`,
        sec.letterGrade,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 118, 110] },
    });
    currentY = ((documentPdf as any).lastAutoTable?.finalY ?? 60) + 8;
  }

  // 100 Soru Ayrıntılı Cevap Listesi
  autoTable(documentPdf, {
    startY: currentY,
    head: [['Soru', 'Anahtar', 'Isaret', 'Durum']],
    body: student.answers.map((answer) => [
      answer.question,
      answer.key,
      answer.marked ?? '-',
      pdfText(answer.status),
    ]),
    styles: { fontSize: 7.5 },
    headStyles: { fillColor: [75, 85, 99] },
  });
  documentPdf.save(`${filenameBase(session)}-${student.studentNumber}.pdf`);
}

function jobRows(jobs: ProcessingJob[]): unknown[][] {
  return [
    ['Kaynak', 'Part', 'Durum', 'Öğrenci No', 'Açıklama', 'Güncelleme'],
    ...jobs.map((job) => [
      job.sourceName,
      job.partIndex + 1,
      job.status,
      job.studentNumber ?? '',
      job.error ?? '',
      job.updatedAt,
    ]),
  ];
}

export async function exportZip(session: ExamSession, jobs: ProcessingJob[] = [], suffix?: string) {
  const { default: JSZip } = await import('jszip');
  const archive = new JSZip();
  archive.file('ogrenci-ozeti.csv', toCsv(summaryRows(session)));
  archive.file('cevap-matrisi.csv', toCsv(answerMatrixRows(session)));
  archive.file('soru-istatistikleri.csv', toCsv(questionRows(session)));
  archive.file('tam-veri.json', JSON.stringify({ schemaVersion: 2, sessions: [session], jobs }, null, 2));
  if (jobs.length) archive.file('islem-manifestosu.csv', toCsv(jobRows(jobs)));
  const studentFolder = archive.folder('ogrenciler');
  session.results.forEach((student, index) => {
    studentFolder?.file(
      `${String(index + 1).padStart(3, '0')}-${safeSpreadsheetCell(student.studentNumber).replace(/[^a-zA-Z0-9_-]/g, '-')}.csv`,
      toCsv([
        ['Soru', 'Anahtar', 'İşaret', 'Durum', 'Güven'],
        ...student.answers.map((answer) => [answer.question, answer.key, answer.marked ?? '', answer.status, answer.confidence]),
      ]),
    );
  });
  const partIndexes = [...new Set(session.results.map((result) => result.partIndex ?? 0))].sort((left, right) => left - right);
  if (partIndexes.length > 1) {
    const partsFolder = archive.folder('partlar');
    partIndexes.forEach((partIndex) => {
      const partSession = { ...session, results: session.results.filter((result) => (result.partIndex ?? 0) === partIndex) };
      const folder = partsFolder?.folder(`part-${String(partIndex + 1).padStart(3, '0')}`);
      folder?.file('ogrenci-ozeti.csv', toCsv(summaryRows(partSession)));
      folder?.file('cevap-matrisi.csv', toCsv(answerMatrixRows(partSession)));
      const partJobs = jobs.filter((job) => job.partIndex === partIndex);
      if (partJobs.length) folder?.file('islem-manifestosu.csv', toCsv(jobRows(partJobs)));
    });
  }
  const blob = await archive.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  downloadBlob(blob, `${filenameBase(session)}-${suffix ?? 'tum-ciktilar'}.zip`);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function printSession(session: ExamSession) {
  const popup = window.open('', '_blank', 'popup');
  if (!popup) throw new Error('Yazdırma penceresi engellendi. Tarayıcı açılır pencere iznini kontrol edin.');
  popup.opener = null;
  const rows = session.results.map((result) => `
    <tr><td>${escapeHtml(result.studentNumber)}</td><td>${result.score.correct}</td><td>${result.score.wrong}</td>
    <td>${result.score.blank}</td><td>${result.score.ambiguous}</td><td>${result.score.net}</td><td>${result.score.percentage}%</td></tr>`).join('');
  popup.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(session.title)}</title>
    <style>body{font:12px Arial,sans-serif;margin:24px;color:#111}h1{font-size:22px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:7px;text-align:left}th{background:#e6fffb}@media print{body{margin:10mm}}</style>
    </head><body><h1>${escapeHtml(session.title)}</h1><p>${session.results.length} öğrenci · 100 soru</p>
    <table><thead><tr><th>Öğrenci No</th><th>Doğru</th><th>Yanlış</th><th>Boş</th><th>Belirsiz</th><th>Net</th><th>Başarı</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 200);
}
