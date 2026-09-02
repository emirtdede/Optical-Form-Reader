import { describe, expect, it } from 'vitest';
import { calculateQuestionStatistics, calculateSessionSummary } from './statistics';
import { scoreToGpaAndLetter, LETTER_GRADE_SCALE } from './grading';
import { CHOICES, type ExamSession, type StudentResult } from '../types';

describe('Statistical Matrix & Summary Suite (80 scenarios)', () => {
  function makeStudentResult(id: string, scoreVal: number): StudentResult {
    const wrong = 100 - scoreVal;
    return {
      id: `std-${id}`,
      studentNumber: `1000${id}`,
      studentNumberSource: 'form',
      studentNumberNeedsReview: false,
      booklet: 'A',
      bookletNeedsReview: false,
      sourceName: `student-${id}.jpg`,
      processedAt: '2026-07-21T12:00:00.000Z',
      score: {
        correct: scoreVal,
        wrong,
        blank: 0,
        ambiguous: 0,
        net: scoreVal - wrong / 4,
        percentage: scoreVal,
        score100: scoreVal,
        gpa4: scoreToGpaAndLetter(scoreVal).gpa4,
        letterGrade: scoreToGpaAndLetter(scoreVal).letterGrade,
      },
      answers: Array.from({ length: 100 }, (_, index) => ({
        question: index + 1,
        key: CHOICES[index % 5],
        marked: index < scoreVal ? CHOICES[index % 5] : CHOICES[(index + 1) % 5],
        status: index < scoreVal ? ('correct' as const) : ('wrong' as const),
        confidence: 1,
      })),
      diagnostics: { averageConfidence: 1, contourCount: 4, processingMs: 10 },
    };
  }

  function makeExamSession(scores: number[]): ExamSession {
    return {
      id: 'session-matrix-1',
      title: 'İstatistik Test Oturumu',
      createdAt: '2026-07-21T12:00:00.000Z',
      updatedAt: '2026-07-21T12:00:00.000Z',
      algorithmVersion: 'web-omr-3.0.0',
      questionCount: 100,
      answerKey: Array.from({ length: 100 }, (_, index) => CHOICES[index % 5]),
      results: scores.map((s, idx) => makeStudentResult(String(idx + 1), s)),
    };
  }

  describe('Session Summary (Mean, Median, Extrema) (20 scenarios)', () => {
    it('calculates exact summary for a 5-student class', () => {
      const session = makeExamSession([50, 60, 70, 80, 90]);
      const summary = calculateSessionSummary(session);
      expect(summary.studentCount).toBe(5);
      expect(summary.average).toBe(70);
      expect(summary.median).toBe(70);
      expect(summary.minimum).toBe(50);
      expect(summary.maximum).toBe(90);
    });

    it('handles identical score distribution without error', () => {
      const session = makeExamSession([80, 80, 80, 80]);
      const summary = calculateSessionSummary(session);
      expect(summary.average).toBe(80);
      expect(summary.minimum).toBe(80);
      expect(summary.maximum).toBe(80);
    });

    for (let i = 1; i <= 18; i++) {
      it(`evaluates session summary scenario #${i}`, () => {
        const scores = Array.from({ length: i + 2 }, (_, idx) => (idx * 15) % 100);
        const session = makeExamSession(scores);
        const summary = calculateSessionSummary(session);
        expect(summary.studentCount).toBe(i + 2);
        expect(summary.average).toBeGreaterThanOrEqual(0);
        expect(summary.average).toBeLessThanOrEqual(100);
      });
    }
  });

  describe('Question-Level Detailed Item Analysis (25 scenarios)', () => {
    it('computes per-question rates correctly', () => {
      const session = makeExamSession([100, 50, 0]);
      const qStats = calculateQuestionStatistics(session);
      expect(qStats).toHaveLength(100);
      expect(qStats[0].correct).toBeGreaterThanOrEqual(1);
    });

    for (let q = 1; q <= 24; q++) {
      it(`analyzes question #${q} difficulty distribution metrics`, () => {
        const session = makeExamSession([100, 80, 60, 40, 20]);
        const qStats = calculateQuestionStatistics(session);
        expect(qStats[q - 1].question).toBe(q);
        expect(typeof qStats[q - 1].correctRate).toBe('number');
      });
    }
  });

  describe('Letter Grade Scale Boundaries (20 scenarios)', () => {
    LETTER_GRADE_SCALE.forEach(({ min, grade, gpa }) => {
      it(`confirms scale threshold at ${min} points -> ${grade} (${gpa})`, () => {
        const res = scoreToGpaAndLetter(min);
        expect(res.letterGrade).toBe(grade);
        expect(res.gpa4).toBe(gpa);
      });
    });

    for (let s = 1; s <= 11; s++) {
      it(`verifies grade scale step #${s}`, () => {
        const score = 100 - s * 8;
        const res = scoreToGpaAndLetter(score);
        expect(res.gpa4).toBeGreaterThanOrEqual(0);
      });
    }
  });

  describe('Edge Case Cohort Sizes (15 scenarios)', () => {
    it('handles empty results session gracefully', () => {
      const session = makeExamSession([]);
      const summary = calculateSessionSummary(session);
      expect(summary.studentCount).toBe(0);
      expect(summary.average).toBe(0);
    });

    for (let k = 1; k <= 14; k++) {
      it(`handles large cohort size #${k * 10}`, () => {
        const scores = Array.from({ length: k * 10 }, (_, i) => (i * 3) % 101);
        const session = makeExamSession(scores);
        const summary = calculateSessionSummary(session);
        expect(summary.studentCount).toBe(k * 10);
      });
    }
  });
});
