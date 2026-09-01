import { describe, expect, it } from 'vitest';
import {
  type AnswerChoice, type BookletType, type ExamSession, type FormReadResult, type StudentResult,
} from '../types';
import { compareWithAnswerKey, recalculateStudentAnswers } from './scoring';
import { getDefaultSections } from './grading';
import { calculateSessionSummary } from './statistics';
import { summaryRows } from '../export/exporters';

describe('Çoklu Kitapçık (A / B / C / D) Kapsamlı Fonksiyonel Doğrulama', () => {
  const keyA: AnswerChoice[] = Array.from({ length: 100 }, () => 'A');
  const keyB: AnswerChoice[] = Array.from({ length: 100 }, () => 'B');
  const keyC: AnswerChoice[] = Array.from({ length: 100 }, () => 'C');
  const keyD: AnswerChoice[] = Array.from({ length: 100 }, () => 'D');

  const bookletKeys: Record<BookletType, AnswerChoice[]> = {
    A: keyA,
    B: keyB,
    C: keyC,
    D: keyD,
  };

  function mockFormRead(answers: Array<AnswerChoice | null>, booklet: BookletType | null, confidence = 0.98): FormReadResult {
    return {
      answers,
      states: answers.map((a) => (a === null ? 'blank' : 'marked')),
      confidences: Array(100).fill(confidence),
      studentNumber: '12345678',
      studentNumberConfidence: 0.99,
      booklet,
      bookletConfidence: confidence,
      diagnostics: { averageConfidence: confidence, contourCount: 100, processingMs: 12 },
    };
  }

  it('1. A ve B kitapçığı kodlayan öğrenciler kendi kitapçık anahtarlarıyla %100 doğrulukla puanlanır', () => {
    const studentAAnswers: AnswerChoice[] = Array(100).fill('A');
    const studentBAnswers: AnswerChoice[] = Array(100).fill('B');

    const resultA = compareWithAnswerKey(bookletKeys, mockFormRead(studentAAnswers, 'A'));
    expect(resultA.booklet).toBe('A');
    expect(resultA.bookletNeedsReview).toBe(false);
    expect(resultA.score.correct).toBe(100);
    expect(resultA.score.wrong).toBe(0);
    expect(resultA.score.net).toBe(100);
    expect(resultA.score.letterGrade).toBe('AA');

    const resultB = compareWithAnswerKey(bookletKeys, mockFormRead(studentBAnswers, 'B'));
    expect(resultB.booklet).toBe('B');
    expect(resultB.bookletNeedsReview).toBe(false);
    expect(resultB.score.correct).toBe(100);
    expect(resultB.score.wrong).toBe(0);
    expect(resultB.score.net).toBe(100);
    expect(resultB.score.letterGrade).toBe('AA');
  });

  it('2. Kitapçık kodlanmamış veya belirsiz ise varsayılan A anahtarı kullanılır ve inceleme bayrağı üretilir', () => {
    const studentAnswers: AnswerChoice[] = Array(100).fill('A');
    const read = mockFormRead(studentAnswers, null);
    const result = compareWithAnswerKey(bookletKeys, read);

    expect(result.booklet).toBe('A');
    expect(result.bookletNeedsReview).toBe(true);
    expect(result.score.correct).toBe(100);
  });

  it('3. Oturumda tanımlanmayan bir kitapçık (örn: C) kodlandığında güvenli fallback yapılır', () => {
    const partialKeys: Partial<Record<BookletType, AnswerChoice[]>> = {
      A: keyA,
      B: keyB,
    };
    const studentAnswers: AnswerChoice[] = Array(100).fill('A');
    const read = mockFormRead(studentAnswers, 'C');
    const result = compareWithAnswerKey(partialKeys, read);

    expect(result.booklet).toBe('C');
    expect(result.bookletNeedsReview).toBe(true);
    expect(result.score.correct).toBe(100);
  });

  it('4. İnceleme çekmecesinde öğrencinin kitapçığı A dan B ye değiştirildiğinde puan anında B anahtarına göre yeniden hesaplanır', () => {
    const studentAnswers: AnswerChoice[] = Array(100).fill('B');
    const read = mockFormRead(studentAnswers, 'A');
    const initialResult = compareWithAnswerKey(bookletKeys, read);

    expect(initialResult.score.correct).toBe(0);
    expect(initialResult.score.wrong).toBe(100);
    expect(initialResult.score.letterGrade).toBe('FF');

    const targetKeyB = bookletKeys.B;
    const recalculated = recalculateStudentAnswers(initialResult.answers, getDefaultSections(), targetKeyB);

    expect(recalculated.score.correct).toBe(100);
    expect(recalculated.score.wrong).toBe(0);
    expect(recalculated.score.net).toBe(100);
    expect(recalculated.score.letterGrade).toBe('AA');
  });

  it('5. 4 Kitapçıklı (A, B, C, D) karma oturumda Excel ve CSV özet tabloları kitapçık sütununu eksiksiz içerir', () => {
    const students: StudentResult[] = (['A', 'B', 'C', 'D'] as BookletType[]).map((bk, i) => {
      const answers = Array(100).fill(bk);
      const { score, answers: scoredAnswers } = compareWithAnswerKey(bookletKeys, mockFormRead(answers, bk));
      return {
        id: `stu-${i + 1}`,
        studentNumber: `1000${i + 1}`,
        studentNumberSource: 'form',
        studentNumberNeedsReview: false,
        booklet: bk,
        bookletNeedsReview: false,
        sourceName: `form-${bk}.png`,
        processedAt: new Date().toISOString(),
        score,
        answers: scoredAnswers,
        diagnostics: { averageConfidence: 0.98, contourCount: 100, processingMs: 10 },
      };
    });

    const session: ExamSession = {
      id: 'session-4-booklets',
      title: '4 Kitapçıklı Final Sınavı',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      algorithmVersion: '3.0.0',
      questionCount: 100,
      answerKey: keyA,
      bookletKeys,
      activeBooklets: ['A', 'B', 'C', 'D'],
      results: students,
    };

    const summary = calculateSessionSummary(session);
    expect(summary.studentCount).toBe(4);
    expect(summary.average).toBe(100);

    const rows = summaryRows(session);
    const headers = rows[0] as string[];
    expect(headers[0]).toBe('Öğrenci No');
    expect(headers[1]).toBe('Kitapçık');

    expect(rows[1][0]).toBe('10001');
    expect(rows[1][1]).toBe('A');

    expect(rows[2][0]).toBe('10002');
    expect(rows[2][1]).toBe('B');

    expect(rows[3][0]).toBe('10003');
    expect(rows[3][1]).toBe('C');

    expect(rows[4][0]).toBe('10004');
    expect(rows[4][1]).toBe('D');
  });
});
