import { CHOICES, type ExamSession, type QuestionStatistics, type Score } from '../types';

export interface SessionSummary {
  studentCount: number;
  average: number;
  median: number;
  minimum: number;
  maximum: number;
  standardDeviation: number;
  totals: { correct: number; wrong: number; blank: number; ambiguous: number };
}

export function calculateQuestionStatistics(session: ExamSession): QuestionStatistics[] {
  return session.answerKey.map((key, index) => {
    const optionCounts = Object.fromEntries(CHOICES.map((choice) => [choice, 0])) as QuestionStatistics['optionCounts'];
    let correct = 0;
    let wrong = 0;
    let blank = 0;
    let ambiguous = 0;

    session.results.forEach((result) => {
      const answer = result.answers[index];
      if (!answer) return;
      if (answer.marked) optionCounts[answer.marked] += 1;
      if (answer.status === 'correct') correct += 1;
      else if (answer.status === 'wrong') wrong += 1;
      else if (answer.status === 'blank') blank += 1;
      else ambiguous += 1;
    });

    const total = session.results.length || 1;
    return {
      question: index + 1,
      key,
      correct,
      wrong,
      blank,
      ambiguous,
      correctRate: Number(((correct / total) * 100).toFixed(2)),
      wrongRate: Number(((wrong / total) * 100).toFixed(2)),
      blankRate: Number(((blank / total) * 100).toFixed(2)),
      difficulty: Number((correct / total).toFixed(4)),
      optionCounts,
    };
  });
}

export function calculateSessionSummary(session: ExamSession): SessionSummary {
  const percentages = session.results.map((result) => result.score.percentage).sort((a, b) => a - b);
  const count = percentages.length;
  const average = count ? percentages.reduce((sum, value) => sum + value, 0) / count : 0;
  const middle = Math.floor(count / 2);
  const median = !count ? 0 : count % 2 ? percentages[middle] : (percentages[middle - 1] + percentages[middle]) / 2;
  const variance = count
    ? percentages.reduce((sum, value) => sum + (value - average) ** 2, 0) / count
    : 0;
  const totals = session.results.reduce(
    (sum, result) => ({
      correct: sum.correct + result.score.correct,
      wrong: sum.wrong + result.score.wrong,
      blank: sum.blank + result.score.blank,
      ambiguous: sum.ambiguous + result.score.ambiguous,
    }),
    { correct: 0, wrong: 0, blank: 0, ambiguous: 0 },
  );

  return {
    studentCount: count,
    average: Number(average.toFixed(2)),
    median: Number(median.toFixed(2)),
    minimum: count ? percentages[0] : 0,
    maximum: count ? percentages[count - 1] : 0,
    standardDeviation: Number(Math.sqrt(variance).toFixed(2)),
    totals,
  };
}
