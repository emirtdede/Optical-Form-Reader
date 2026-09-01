import { describe, expect, it } from 'vitest';
import { calculateQuestionStatistics, calculateSessionSummary } from './statistics';
import { CHOICES, type ExamSession, type StudentResult } from '../types';

function student(id: string, percentage: number, firstStatus: 'correct' | 'wrong' | 'blank'): StudentResult {
  const answers = Array.from({ length: 100 }, (_, index) => ({
    question: index + 1,
    key: CHOICES[index % CHOICES.length],
    marked: index === 0 && firstStatus === 'blank' ? null : index === 0 && firstStatus === 'wrong' ? 'B' as const : CHOICES[index % CHOICES.length],
    status: index === 0 ? firstStatus : 'correct' as const,
    confidence: 1,
  }));
  const wrong = firstStatus === 'wrong' ? 1 : 0;
  const blank = firstStatus === 'blank' ? 1 : 0;
  return {
    id,
    studentNumber: `1234${id}`,
    studentNumberSource: 'form',
    studentNumberNeedsReview: false,
    booklet: 'A',
    bookletNeedsReview: false,
    sourceName: `${id}.png`,
    processedAt: '2026-07-21T12:00:00.000Z',
    score: { correct: 100 - wrong - blank, wrong, blank, ambiguous: 0, net: 100 - wrong - blank - wrong / 4, percentage, score100: percentage, gpa4: 4.0, letterGrade: 'AA' },
    answers,
    diagnostics: { averageConfidence: 1, contourCount: 5, processingMs: 10 },
  };
}

describe('statistics', () => {
  const session: ExamSession = {
    id: 'session',
    title: 'Deneme',
    createdAt: '2026-07-21T12:00:00.000Z',
    updatedAt: '2026-07-21T12:00:00.000Z',
    algorithmVersion: 'test',
    questionCount: 100,
    answerKey: Array.from({ length: 100 }, (_, index) => CHOICES[index % CHOICES.length]),
    results: [student('1', 100, 'correct'), student('2', 99, 'wrong'), student('3', 99, 'blank')],
  };

  it('oturum özetinde ortalama, medyan ve uçları hesaplar', () => {
    expect(calculateSessionSummary(session)).toMatchObject({ studentCount: 3, average: 99.33, median: 99, minimum: 99, maximum: 100 });
  });

  it('soru başına doğru, yanlış, boş ve seçenek dağılımını hesaplar', () => {
    expect(calculateQuestionStatistics(session)[0]).toMatchObject({ correct: 1, wrong: 1, blank: 1, correctRate: 33.33, wrongRate: 33.33, blankRate: 33.33 });
  });
});
