import type {
  AnswerChoice,
  AnswerStatus,
  BookletType,
  ExamSection,
  FormReadResult,
  QuestionResult,
  Score,
} from '../types';
import { calculateSectionScores, getDefaultSections, scoreToGpaAndLetter } from './grading';

export const QUESTION_COUNT = 100 as const;
export const ALGORITHM_VERSION = 'web-omr-3.0.0';
export const WRONG_PENALTY = 4;

export function isCompleteAnswerKey(read: FormReadResult): read is FormReadResult & { answers: AnswerChoice[] } {
  return read.answers.length === QUESTION_COUNT
    && read.states.length === QUESTION_COUNT
    && read.answers.every((answer, index) => answer !== null && read.states[index] === 'marked');
}

export function compareWithAnswerKey(
  answerKey: AnswerChoice[] | Partial<Record<BookletType, AnswerChoice[]>>,
  read: FormReadResult,
  sections: ExamSection[] = getDefaultSections(),
  questionWeights?: number[],
  forcedBooklet?: BookletType,
): { answers: QuestionResult[]; score: Score; booklet: BookletType; bookletNeedsReview: boolean } {
  const isMap = !Array.isArray(answerKey);
  const detectedBooklet: BookletType = forcedBooklet ?? read.booklet ?? 'A';
  
  let activeKey: AnswerChoice[];
  let bookletNeedsReview = !read.booklet || (read.bookletConfidence !== undefined && read.bookletConfidence !== null && read.bookletConfidence < 0.6);

  if (isMap) {
    const candidateKey = answerKey[detectedBooklet];
    if (candidateKey && candidateKey.length === QUESTION_COUNT) {
      activeKey = candidateKey;
    } else {
      activeKey = (answerKey.A ?? Object.values(answerKey).find((k) => k && k.length === QUESTION_COUNT)) as AnswerChoice[];
      if (!activeKey) {
        throw new Error('Geçerli bir cevap anahtarı bulunamadı.');
      }
      bookletNeedsReview = true;
    }
  } else {
    activeKey = answerKey;
  }

  if (activeKey.length !== QUESTION_COUNT || read.answers.length !== QUESTION_COUNT) {
    throw new Error('Form ve cevap anahtarı 100 soru içermelidir.');
  }

  const totals = { correct: 0, wrong: 0, blank: 0, ambiguous: 0 };
  let totalMaxWeight = 0;
  let weightedCorrect = 0;
  let weightedWrong = 0;

  const answers = activeKey.map<QuestionResult>((key, index) => {
    const marked = read.answers[index] ?? null;
    let status: AnswerStatus;

    if (read.states?.[index] === 'ambiguous') status = 'ambiguous';
    else if (marked === null) status = 'blank';
    else if (marked === key) status = 'correct';
    else status = 'wrong';

    totals[status] += 1;
    const weight = questionWeights && questionWeights[index] > 0 ? questionWeights[index] : 1;
    totalMaxWeight += weight;

    if (status === 'correct') weightedCorrect += weight;
    else if (status === 'wrong') weightedWrong += weight;

    return {
      question: index + 1,
      key,
      marked,
      status,
      confidence: read.confidences?.[index] ?? 0,
      weight,
    };
  });

  const net = Number((totals.correct - totals.wrong / WRONG_PENALTY).toFixed(2));
  const weightedNet = totalMaxWeight > 0
    ? Math.max(0, weightedCorrect - (weightedWrong / WRONG_PENALTY))
    : net;

  const score100 = totalMaxWeight > 0
    ? Number(Math.max(0, Math.min(100, (weightedNet / totalMaxWeight) * 100)).toFixed(2))
    : Number(Math.max(0, Math.min(100, (net / QUESTION_COUNT) * 100)).toFixed(2));

  const { gpa4, letterGrade } = scoreToGpaAndLetter(score100);
  const sectionScores = calculateSectionScores(answers, sections, WRONG_PENALTY);

  const score: Score = {
    ...totals,
    net,
    percentage: Number(((totals.correct / QUESTION_COUNT) * 100).toFixed(2)),
    score100,
    gpa4,
    letterGrade,
    sections: sectionScores,
  };

  return { answers, score, booklet: detectedBooklet, bookletNeedsReview };
}

export function recalculateStudentAnswers(
  answers: QuestionResult[],
  sections: ExamSection[] = getDefaultSections(),
  newKey?: AnswerChoice[],
): { answers: QuestionResult[]; score: Score } {
  let totalMaxWeight = 0;
  let weightedCorrect = 0;
  let weightedWrong = 0;

  const normalized = answers.map((answer, index) => {
    const key = newKey?.[index] ?? answer.key;
    const status: AnswerStatus = answer.marked === null
      ? answer.status === 'ambiguous' ? 'ambiguous' : 'blank'
      : answer.marked === key
        ? 'correct'
        : 'wrong';

    const weight = answer.weight && answer.weight > 0 ? answer.weight : 1;
    totalMaxWeight += weight;
    if (status === 'correct') weightedCorrect += weight;
    else if (status === 'wrong') weightedWrong += weight;

    return { ...answer, key, status, confidence: 1, weight };
  });

  const totals = normalized.reduce(
    (sum, answer) => ({ ...sum, [answer.status]: sum[answer.status] + 1 }),
    { correct: 0, wrong: 0, blank: 0, ambiguous: 0 },
  );

  const net = Number((totals.correct - totals.wrong / WRONG_PENALTY).toFixed(2));
  const weightedNet = totalMaxWeight > 0
    ? Math.max(0, weightedCorrect - (weightedWrong / WRONG_PENALTY))
    : net;

  const score100 = totalMaxWeight > 0
    ? Number(Math.max(0, Math.min(100, (weightedNet / totalMaxWeight) * 100)).toFixed(2))
    : Number(Math.max(0, Math.min(100, (net / QUESTION_COUNT) * 100)).toFixed(2));

  const { gpa4, letterGrade } = scoreToGpaAndLetter(score100);
  const sectionScores = calculateSectionScores(normalized, sections, WRONG_PENALTY);

  return {
    answers: normalized,
    score: {
      ...totals,
      net,
      percentage: Number(((totals.correct / QUESTION_COUNT) * 100).toFixed(2)),
      score100,
      gpa4,
      letterGrade,
      sections: sectionScores,
    },
  };
}
