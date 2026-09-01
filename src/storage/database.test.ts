import { beforeEach, describe, expect, it } from 'vitest';
import { checkpointResult, clearSessions, createProcessingSession, getSession, isExamSession, listProcessingJobs, putSession } from './database';
import { CHOICES, type ExamSession } from '../types';

function validSession(): ExamSession {
  const answerKey = Array.from({ length: 100 }, (_, index) => CHOICES[index % CHOICES.length]);
  const answers = answerKey.map((key, index) => ({ question: index + 1, key, marked: key, status: 'correct' as const, confidence: 1 }));
  return {
    id: 'session-1',
    title: 'Deneme',
    createdAt: '2026-07-21T12:00:00.000Z',
    updatedAt: '2026-07-21T12:00:00.000Z',
    algorithmVersion: 'web-omr-3.0.0',
    questionCount: 100,
    answerKey,
    results: [{
      id: 'student-1',
      studentNumber: '12345678901',
      studentNumberSource: 'form',
      studentNumberNeedsReview: false,
      sourceName: 'student.png',
      processedAt: '2026-07-21T12:00:00.000Z',
      score: { correct: 100, wrong: 0, blank: 0, ambiguous: 0, net: 100, percentage: 100, score100: 100, gpa4: 4.0, letterGrade: 'AA' },
      answers,
      diagnostics: { averageConfidence: 1, contourCount: 5, processingMs: 10 },
    }],
  };
}

describe('backup validation', () => {
  beforeEach(async () => {
    await clearSessions();
  });

  it('uygulamanın ürettiği tam kaydı kabul eder', () => {
    expect(isExamSession(validSession())).toBe(true);
  });

  it('bozuk cevap dizisini ve hesapla uyuşmayan puanı reddeder', () => {
    const brokenAnswers = validSession();
    brokenAnswers.results[0].answers = brokenAnswers.results[0].answers.slice(0, 99);
    expect(isExamSession(brokenAnswers)).toBe(false);

    const brokenScore = validSession();
    brokenScore.results[0].score.correct = 99;
    expect(isExamSession(brokenScore)).toBe(false);
  });

  it('öğrenci sonucu sayısına yapay 100 kayıt sınırı koymaz', () => {
    const session = validSession();
    const template = session.results[0];
    session.results = Array.from({ length: 125 }, (_, index) => ({
      ...template,
      id: `student-${index + 1}`,
      studentNumber: String(index + 1).padStart(5, '0'),
      answers: template.answers.map((answer) => ({ ...answer })),
    }));
    expect(isExamSession(session)).toBe(true);
  });

  it('normalize IndexedDB yapısında oturumu ve sonuçlarını yeniden birleştirir', async () => {
    const session = validSession();
    await putSession(session);
    await expect(getSession(session.id)).resolves.toEqual(session);
  });

  it('öğrenci sonucunu ve iş manifestosunu aynı checkpoint içinde saklar', async () => {
    const complete = validSession();
    const result = complete.results[0];
    const session = { ...complete, results: [] };
    await createProcessingSession(session);
    await checkpointResult(session, result, {
      id: 'job-1',
      sessionId: session.id,
      sourceName: result.sourceName,
      sourceFingerprint: 'abc',
      partIndex: 0,
      status: 'completed',
      studentNumber: result.studentNumber,
      resultId: result.id,
      updatedAt: complete.updatedAt,
    });
    expect((await getSession(session.id))?.results).toEqual([result]);
    expect(await listProcessingJobs(session.id)).toHaveLength(1);
  });
});
