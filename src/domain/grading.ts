import type { ExamSection, LetterGrade, QuestionResult, Score, SectionScore, StudentResult } from '../types';

export const LETTER_GRADE_SCALE: Array<{ min: number; grade: LetterGrade; gpa: number; label: string }> = [
  { min: 90, grade: 'AA', gpa: 4.0, label: 'Mükemmel' },
  { min: 85, grade: 'BA', gpa: 3.5, label: 'Çok İyi' },
  { min: 80, grade: 'BB', gpa: 3.0, label: 'İyi' },
  { min: 75, grade: 'CB', gpa: 2.5, label: 'Orta Üstü' },
  { min: 70, grade: 'CC', gpa: 2.0, label: 'Orta (Geçer)' },
  { min: 65, grade: 'DC', gpa: 1.5, label: 'Koşullu Geçer' },
  { min: 60, grade: 'DD', gpa: 1.0, label: 'Koşullu Geçer' },
  { min: 50, grade: 'FD', gpa: 0.5, label: 'Başarısız' },
  { min: 0, grade: 'FF', gpa: 0.0, label: 'Kaldı' },
];

/**
 * 100'lük sistemdeki puanı YÖK harf notuna ve 4.00'lük katsayıya dönüştürür.
 */
export function scoreToGpaAndLetter(score100: number): { gpa4: number; letterGrade: LetterGrade } {
  const normalized = Math.max(0, Math.min(100, Number.isFinite(score100) ? score100 : 0));
  for (const scale of LETTER_GRADE_SCALE) {
    if (normalized >= scale.min) {
      return { gpa4: scale.gpa, letterGrade: scale.grade };
    }
  }
  return { gpa4: 0.0, letterGrade: 'FF' };
}

/**
 * Varsayılan 4 eşit parçalı (1-25, 26-50, 51-75, 76-100) bölüm şablonu üretir.
 */
export function getDefaultSections(): ExamSection[] {
  return [
    { id: 'sec-1', name: 'Bölüm 1', startQuestion: 1, endQuestion: 25, weight: 1 },
    { id: 'sec-2', name: 'Bölüm 2', startQuestion: 26, endQuestion: 50, weight: 1 },
    { id: 'sec-3', name: 'Bölüm 3', startQuestion: 51, endQuestion: 75, weight: 1 },
    { id: 'sec-4', name: 'Bölüm 4', startQuestion: 76, endQuestion: 100, weight: 1 },
  ];
}

/**
 * Öğrencinin cevaplarını tanımlı bölümlere göre ayırıp her bölüm için ayrı skor üretir.
 */
export function calculateSectionScores(
  answers: QuestionResult[],
  sections: ExamSection[] = getDefaultSections(),
  penaltyDivider = 4,
): SectionScore[] {
  return sections.map((section) => {
    const start = Math.max(1, section.startQuestion);
    const end = Math.min(100, section.endQuestion);
    const sectionAnswers = answers.filter((a) => a.question >= start && a.question <= end);
    const count = sectionAnswers.length || Math.max(1, end - start + 1);

    const totals = sectionAnswers.reduce(
      (acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
      },
      { correct: 0, wrong: 0, blank: 0, ambiguous: 0 } as Record<string, number>,
    );

    const net = Number((totals.correct - totals.wrong / penaltyDivider).toFixed(2));
    const score100 = Number(Math.max(0, Math.min(100, (net / count) * 100)).toFixed(2));
    const { gpa4, letterGrade } = scoreToGpaAndLetter(score100);

    return {
      sectionId: section.id,
      name: section.name.trim() || `Bölüm ${start}-${end}`,
      startQuestion: start,
      endQuestion: end,
      questionCount: count,
      correct: totals.correct,
      wrong: totals.wrong,
      blank: totals.blank,
      ambiguous: totals.ambiguous,
      net,
      score100,
      gpa4,
      letterGrade,
    };
  });
}

/**
 * Çan Eğrisi (T-Skor Bağıl Değerlendirme) Harf Eşlemesi Tablosu
 */
export function tScoreToLetterGrade(tScore: number): { relativeGrade: LetterGrade; gpa4: number } {
  if (tScore >= 67) return { relativeGrade: 'AA', gpa4: 4.0 };
  if (tScore >= 62) return { relativeGrade: 'BA', gpa4: 3.5 };
  if (tScore >= 57) return { relativeGrade: 'BB', gpa4: 3.0 };
  if (tScore >= 52) return { relativeGrade: 'CB', gpa4: 2.5 };
  if (tScore >= 47) return { relativeGrade: 'CC', gpa4: 2.0 };
  if (tScore >= 42) return { relativeGrade: 'DC', gpa4: 1.5 };
  if (tScore >= 37) return { relativeGrade: 'DD', gpa4: 1.0 };
  if (tScore >= 32) return { relativeGrade: 'FD', gpa4: 0.5 };
  return { relativeGrade: 'FF', gpa4: 0.0 };
}

export interface RelativeGradingReport {
  mean: number;
  standardDeviation: number;
  minScore: number;
  maxScore: number;
  studentCount: number;
}

/**
 * Sınav oturumundaki tüm öğrenciler için Çan Eğrisi (T-Skor) hesaplar ve öğrenci skorlarını günceller.
 */
export function applyRelativeGrading(
  results: StudentResult[],
  rawScoreBaraj = 30,
): { results: StudentResult[]; report: RelativeGradingReport } {
  if (results.length === 0) {
    return {
      results: [],
      report: { mean: 0, standardDeviation: 0, minScore: 0, maxScore: 0, studentCount: 0 },
    };
  }

  const scores = results.map((r) => r.score.score100);
  const studentCount = scores.length;
  const mean = Number((scores.reduce((a, b) => a + b, 0) / studentCount).toFixed(2));
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  const variance = studentCount > 1
    ? scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / (studentCount - 1)
    : 0;
  const standardDeviation = Number((Math.sqrt(variance) || 1).toFixed(2));

  const updatedResults = results.map((student) => {
    const rawScore = student.score.score100;
    // Standart sapma 0 ise (tüm öğrenciler aynı puanı aldıysa) T-skor 50
    const zScore = standardDeviation > 0 ? (rawScore - mean) / standardDeviation : 0;
    const tScore = Number((10 * zScore + 50).toFixed(2));

    // Baraj altı kontrolü (örneğin 30 altı ham puanlar doğrudan FF sayılabilir)
    let { relativeGrade } = tScoreToLetterGrade(tScore);
    if (rawScore < rawScoreBaraj) {
      relativeGrade = 'FF';
    }

    const updatedScore: Score = {
      ...student.score,
      tScore,
      relativeGrade,
    };

    return {
      ...student,
      score: updatedScore,
    };
  });

  return {
    results: updatedResults,
    report: {
      mean,
      standardDeviation,
      minScore,
      maxScore,
      studentCount,
    },
  };
}
