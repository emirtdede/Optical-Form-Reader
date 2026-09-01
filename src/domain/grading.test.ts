import { describe, expect, it } from 'vitest';
import { applyRelativeGrading, calculateSectionScores, getDefaultSections, getPresetSections, scoreToGpaAndLetter, tScoreToLetterGrade } from './grading';
import { CHOICES, type AnswerChoice, type QuestionResult, type StudentResult } from '../types';

describe('grading domain', () => {
  it('100lük puanı YÖK harf notuna ve 4lük sisteme doğru dönüştürür', () => {
    expect(scoreToGpaAndLetter(95)).toEqual({ letterGrade: 'AA', gpa4: 4.0 });
    expect(scoreToGpaAndLetter(88)).toEqual({ letterGrade: 'BA', gpa4: 3.5 });
    expect(scoreToGpaAndLetter(81)).toEqual({ letterGrade: 'BB', gpa4: 3.0 });
    expect(scoreToGpaAndLetter(76)).toEqual({ letterGrade: 'CB', gpa4: 2.5 });
    expect(scoreToGpaAndLetter(71)).toEqual({ letterGrade: 'CC', gpa4: 2.0 });
    expect(scoreToGpaAndLetter(66)).toEqual({ letterGrade: 'DC', gpa4: 1.5 });
    expect(scoreToGpaAndLetter(61)).toEqual({ letterGrade: 'DD', gpa4: 1.0 });
    expect(scoreToGpaAndLetter(55)).toEqual({ letterGrade: 'FD', gpa4: 0.5 });
    expect(scoreToGpaAndLetter(42)).toEqual({ letterGrade: 'FF', gpa4: 0.0 });
  });

  it('1, 2 ve 4 bölümlük hazır şablonları doğru oluşturur', () => {
    // 1 Bölüm
    const sec1 = getPresetSections(1);
    expect(sec1).toHaveLength(1);
    expect(sec1[0]).toEqual({ id: 'sec-1', name: 'Bölüm 1', startQuestion: 1, endQuestion: 100, weight: 1 });

    // 2 Bölüm
    const sec2 = getPresetSections(2);
    expect(sec2).toHaveLength(2);
    expect(sec2[0]).toEqual({ id: 'sec-1', name: 'Bölüm 1', startQuestion: 1, endQuestion: 50, weight: 1 });
    expect(sec2[1]).toEqual({ id: 'sec-2', name: 'Bölüm 2', startQuestion: 51, endQuestion: 100, weight: 1 });

    // 4 Bölüm & Varsayılan
    const sec4 = getPresetSections(4);
    expect(sec4).toHaveLength(4);
    expect(sec4[0]).toEqual({ id: 'sec-1', name: 'Bölüm 1', startQuestion: 1, endQuestion: 25, weight: 1 });
    expect(sec4[1]).toEqual({ id: 'sec-2', name: 'Bölüm 2', startQuestion: 26, endQuestion: 50, weight: 1 });
    expect(sec4[2]).toEqual({ id: 'sec-3', name: 'Bölüm 3', startQuestion: 51, endQuestion: 75, weight: 1 });
    expect(sec4[3]).toEqual({ id: 'sec-4', name: 'Bölüm 4', startQuestion: 76, endQuestion: 100, weight: 1 });

    expect(getDefaultSections()).toEqual(sec4);
  });

  it('cevapları tanımlı bölümlere göre ayırarak ayrı ayrı notlandırır', () => {
    const answers: QuestionResult[] = Array.from({ length: 100 }, (_, index) => {
      // 1-25: hepsi doğru (25 D, net 25)
      // 26-50: 20 doğru, 4 yanlış, 1 boş (net 19)
      // 51-75: 15 doğru, 8 yanlış, 2 boş (net 13)
      // 76-100: hepsi boş (net 0)
      const q = index + 1;
      let status: QuestionResult['status'] = 'correct';
      if (q >= 26 && q <= 50) {
        if (q <= 45) status = 'correct';
        else if (q <= 49) status = 'wrong';
        else status = 'blank';
      } else if (q >= 51 && q <= 75) {
        if (q <= 65) status = 'correct';
        else if (q <= 73) status = 'wrong';
        else status = 'blank';
      } else if (q >= 76) {
        status = 'blank';
      }

      return {
        question: q,
        key: 'A',
        marked: status === 'correct' ? 'A' : status === 'wrong' ? 'B' : null,
        status,
        confidence: 1,
      };
    });

    const sectionScores = calculateSectionScores(answers);
    expect(sectionScores).toHaveLength(4);
    expect(sectionScores[0].net).toBe(25);
    expect(sectionScores[0].score100).toBe(100);
    expect(sectionScores[0].letterGrade).toBe('AA');

    expect(sectionScores[1].correct).toBe(20);
    expect(sectionScores[1].wrong).toBe(4);
    expect(sectionScores[1].net).toBe(19);
    expect(sectionScores[1].score100).toBe(76);
    expect(sectionScores[1].letterGrade).toBe('CB');

    expect(sectionScores[2].net).toBe(13);
    expect(sectionScores[3].net).toBe(0);
    expect(sectionScores[3].letterGrade).toBe('FF');
  });

  it('Çan eğrisi (T-Skor bağıl değerlendirme) modelini sınıf genelinde doğru uygular', () => {
    const makeStudent = (id: string, score100: number): StudentResult => ({
      id,
      studentNumber: `100${id}`,
      studentNumberSource: 'form',
      studentNumberNeedsReview: false,
      booklet: 'A',
      bookletNeedsReview: false,
      sourceName: `student-${id}.png`,
      processedAt: '2026-09-01T10:00:00.000Z',
      answers: [],
      diagnostics: { averageConfidence: 1, contourCount: 1, processingMs: 5 },
      score: {
        correct: score100,
        wrong: 100 - score100,
        blank: 0,
        ambiguous: 0,
        net: score100,
        percentage: score100,
        score100,
        gpa4: 2.0,
        letterGrade: 'CC',
      },
    });

    const students = [
      makeStudent('1', 90),
      makeStudent('2', 80),
      makeStudent('3', 70),
      makeStudent('4', 60),
      makeStudent('5', 50),
    ];

    const { results, report } = applyRelativeGrading(students);
    expect(report.mean).toBe(70);
    expect(report.studentCount).toBe(5);
    expect(report.minScore).toBe(50);
    expect(report.maxScore).toBe(90);

    // 70 puan (tam ortalama) alan öğrencinin Z=0, T=50 olmalı
    const studentMiddle = results.find((s) => s.id === '3');
    expect(studentMiddle?.score.tScore).toBe(50);
    expect(studentMiddle?.score.relativeGrade).toBe('CC');

    // 90 puan alan üstün öğrencinin T skoru 60+ olmalı
    const studentTop = results.find((s) => s.id === '1');
    expect((studentTop?.score.tScore ?? 0) > 60).toBe(true);
  });
});
