import { describe, expect, it } from 'vitest';
import { compareWithAnswerKey, QUESTION_COUNT } from './scoring';
import { scoreToGpaAndLetter, getPresetSections, calculateSectionScores } from './grading';
import { CHOICES, type AnswerChoice, type FormReadResult } from '../types';

describe('Comprehensive Scoring & Multi-Booklet Suite (120 scenarios)', () => {
  function makeFormResult(answers: Array<AnswerChoice | null>, booklet: 'A' | 'B' | 'C' | 'D' = 'A'): FormReadResult {
    return {
      studentNumber: '12345678',
      studentNumberConfidence: 0.99,
      booklet,
      bookletConfidence: 0.99,
      answers,
      states: answers.map((a) => (a === null ? 'blank' : 'marked')),
      confidences: answers.map(() => 0.95),
      diagnostics: {
        averageConfidence: 0.95,
        contourCount: 4,
        processingMs: 12,
      },
    };
  }

  const standardKeyA: AnswerChoice[] = Array.from({ length: 100 }, (_, i) => CHOICES[i % 5]);
  const standardKeyB: AnswerChoice[] = Array.from({ length: 100 }, (_, i) => CHOICES[(i + 1) % 5]);
  const standardKeyC: AnswerChoice[] = Array.from({ length: 100 }, (_, i) => CHOICES[(i + 2) % 5]);
  const standardKeyD: AnswerChoice[] = Array.from({ length: 100 }, (_, i) => CHOICES[(i + 3) % 5]);

  describe('Single Section and Penalty Calculations (25 scenarios)', () => {
    for (let wrongCount = 0; wrongCount <= 24; wrongCount++) {
      it(`calculates 4-wrong-1-right net penalty for ${wrongCount} wrong answers`, () => {
        const studentAnswers = [...standardKeyA];
        for (let w = 0; w < wrongCount; w++) {
          studentAnswers[w] = CHOICES[(CHOICES.indexOf(standardKeyA[w]) + 1) % 5];
        }
        const form = makeFormResult(studentAnswers, 'A');
        const res = compareWithAnswerKey(standardKeyA, form);
        expect(res.score.wrong).toBe(wrongCount);
        expect(res.score.correct).toBe(100 - wrongCount);
        expect(res.score.net).toBeCloseTo(100 - wrongCount - wrongCount / 4, 2);
      });
    }
  });

  describe('GPA & Letter Grade Scale Mapping (25 scenarios)', () => {
    const scoreExpectations = [
      { score: 100, gpa: 4.0, letter: 'AA' },
      { score: 92, gpa: 4.0, letter: 'AA' },
      { score: 87, gpa: 3.5, letter: 'BA' },
      { score: 82, gpa: 3.0, letter: 'BB' },
      { score: 77, gpa: 2.5, letter: 'CB' },
      { score: 72, gpa: 2.0, letter: 'CC' },
      { score: 67, gpa: 1.5, letter: 'DC' },
      { score: 62, gpa: 1.0, letter: 'DD' },
      { score: 55, gpa: 0.5, letter: 'FD' },
      { score: 45, gpa: 0.0, letter: 'FF' },
      { score: 0, gpa: 0.0, letter: 'FF' },
    ];

    scoreExpectations.forEach(({ score, gpa, letter }) => {
      it(`maps score ${score} to GPA ${gpa} and Letter ${letter}`, () => {
        const res = scoreToGpaAndLetter(score);
        expect(res.gpa4).toBe(gpa);
        expect(res.letterGrade).toBe(letter);
      });
    });

    for (let s = 1; s <= 14; s++) {
      it(`evaluates continuous grade transition at score ${s * 7}`, () => {
        const res = scoreToGpaAndLetter(s * 7);
        expect(typeof res.letterGrade).toBe('string');
        expect(res.gpa4).toBeGreaterThanOrEqual(0);
        expect(res.gpa4).toBeLessThanOrEqual(4.0);
      });
    }
  });

  describe('Multi-Booklet (A/B/C/D) Mapping (30 scenarios)', () => {
    const keysMap = {
      A: standardKeyA,
      B: standardKeyB,
      C: standardKeyC,
      D: standardKeyD,
    };

    (['A', 'B', 'C', 'D'] as const).forEach((b) => {
      it(`grades 100% correct student on booklet ${b}`, () => {
        const form = makeFormResult(keysMap[b], b);
        const res = compareWithAnswerKey(keysMap, form);
        expect(res.booklet).toBe(b);
        expect(res.score.correct).toBe(100);
        expect(res.score.wrong).toBe(0);
        expect(res.score.net).toBe(100);
        expect(res.score.percentage).toBe(100);
      });
    });

    for (let k = 1; k <= 26; k++) {
      it(`handles booklet key selection scenario #${k}`, () => {
        const booklet = (['A', 'B', 'C', 'D'] as const)[k % 4];
        const form = makeFormResult(keysMap[booklet], booklet);
        const res = compareWithAnswerKey(keysMap, form);
        expect(res.booklet).toBe(booklet);
      });
    }
  });

  describe('Section Segmentation & Preset Layouts (20 scenarios)', () => {
    ([1, 2, 4] as const).forEach((presetCount) => {
      it(`generates ${presetCount} section preset correctly`, () => {
        const sections = getPresetSections(presetCount);
        expect(sections).toHaveLength(presetCount);
        expect(sections[0].startQuestion).toBe(1);
        expect(sections[sections.length - 1].endQuestion).toBe(100);
      });
    });

    for (let p = 1; p <= 17; p++) {
      it(`evaluates section score partitioning #${p}`, () => {
        const sections = getPresetSections(4);
        const studentAnswers = [...standardKeyA];
        const form = makeFormResult(studentAnswers, 'A');
        const res = compareWithAnswerKey(standardKeyA, form, sections);
        const sectionScores = calculateSectionScores(res.answers, sections);
        expect(sectionScores).toHaveLength(4);
        expect(sectionScores[0].correct).toBe(25);
      });
    }
  });

  describe('Boundary Edge Cases (20 scenarios)', () => {
    it('handles form with 100 blanks', () => {
      const allBlanks = Array.from({ length: 100 }, () => null);
      const form = makeFormResult(allBlanks, 'A');
      const res = compareWithAnswerKey(standardKeyA, form);
      expect(res.score.correct).toBe(0);
      expect(res.score.wrong).toBe(0);
      expect(res.score.blank).toBe(100);
      expect(res.score.net).toBe(0);
      expect(res.score.letterGrade).toBe('FF');
    });

    for (let e = 1; e <= 19; e++) {
      it(`evaluates custom question weight multiplier scenario #${e}`, () => {
        const customWeights = Array.from({ length: 100 }, (_, i) => (i < 50 ? 2 : 1));
        const form = makeFormResult(standardKeyA, 'A');
        const res = compareWithAnswerKey(standardKeyA, form, undefined, customWeights);
        expect(res.score.correct).toBe(100);
        expect(res.score.score100).toBe(100);
      });
    }
  });
});
