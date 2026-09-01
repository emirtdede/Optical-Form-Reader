import { describe, expect, it } from 'vitest';
import { compareWithAnswerKey, isCompleteAnswerKey, recalculateStudentAnswers } from './scoring';
import { CHOICES, type AnswerChoice, type FormReadResult, type ReadState } from '../types';

function readResult(
  answers: Array<AnswerChoice | null>,
  states: ReadState[] = answers.map((answer) => answer ? 'marked' : 'blank'),
): FormReadResult {
  return {
    answers,
    states,
    confidences: answers.map(() => 1),
    studentNumber: '12345678901',
    studentNumberConfidence: 1,
    diagnostics: { averageConfidence: 1, contourCount: 5, processingMs: 10 },
  };
}

describe('scoring', () => {
  const answerKey = Array.from({ length: 100 }, (_, index) => CHOICES[index % CHOICES.length]);

  it('yalnızca 100 tam işaretli cevabı geçerli anahtar sayar', () => {
    expect(isCompleteAnswerKey(readResult(answerKey))).toBe(true);
    expect(isCompleteAnswerKey(readResult([...answerKey.slice(0, 99), null]))).toBe(false);
  });

  it('80 doğru, 10 yanlış ve 10 boş formu doğru hesaplar', () => {
    const studentAnswers = answerKey.map((answer, index) => {
      if (index >= 90) return null;
      if (index >= 80) return CHOICES[(CHOICES.indexOf(answer) + 1) % CHOICES.length];
      return answer;
    });
    const result = compareWithAnswerKey(answerKey, readResult(studentAnswers));
    expect(result.score.correct).toBe(80);
    expect(result.score.wrong).toBe(10);
    expect(result.score.blank).toBe(10);
    expect(result.score.net).toBe(77.5);
    expect(result.score.score100).toBe(77.5);
    expect(result.score.letterGrade).toBe('CB');
    expect(result.score.gpa4).toBe(2.5);
    expect(result.score.sections).toHaveLength(4);
  });

  it('manuel inceleme açıldığında belirsiz cevabı kendiliğinden boşa çevirmez', () => {
    const compared = compareWithAnswerKey(
      answerKey,
      readResult([null, ...answerKey.slice(1)], ['ambiguous', ...answerKey.slice(1).map(() => 'marked' as const)]),
    );
    const recalculated = recalculateStudentAnswers(compared.answers);
    expect(recalculated.answers[0].status).toBe('ambiguous');
    expect(recalculated.score.ambiguous).toBe(1);
  });
});
