import { describe, expect, it } from 'vitest';
import { CHOICES, type AnswerChoice, type ExamSession, type StudentResult } from '../types';
import { compareWithAnswerKey, recalculateStudentAnswers } from './scoring';
import { applyRelativeGrading, getDefaultSections } from './grading';
import { calculateQuestionStatistics, calculateSessionSummary } from './statistics';
import { summaryRows } from '../export/exporters';

describe('E2E Complete User Workflow Audit', () => {
  it('oturum oluşturma, bölümlendirme, katsayı hesaplama, çan eğrisi ve dışa aktarma akışını uçtan uca doğrular', () => {
    // 1. Setup default sections
    const sections = getDefaultSections();
    expect(sections).toHaveLength(4);
    expect(sections[0].name).toBe('Bölüm 1');

    // 2. Answer key setup (100 questions)
    const answerKey: AnswerChoice[] = Array.from({ length: 100 }, (_, i) => CHOICES[i % 5]);

    // 3. Mock 5 student results with varying performance
    const mockStudents: StudentResult[] = [
      createStudent('STU-001', answerKey, 0),   // 100% correct
      createStudent('STU-002', answerKey, 10),  // 90 correct, 10 wrong
      createStudent('STU-003', answerKey, 20),  // 80 correct, 20 wrong
      createStudent('STU-004', answerKey, 40),  // 60 correct, 40 wrong
      createStudent('STU-005', answerKey, 60),  // 40 correct, 60 wrong
    ];

    const session: ExamSession = {
      id: 'session-e2e-100',
      title: 'E2E Sınav Simülasyonu',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      algorithmVersion: '2.1.0',
      questionCount: 100,
      answerKey,
      sections,
      results: mockStudents,
    };

    // 4. Session statistics computation
    const summary = calculateSessionSummary(session);
    expect(summary.studentCount).toBe(5);
    expect(summary.maximum).toBe(100);
    expect(summary.average).toBeGreaterThan(0);

    const questionStats = calculateQuestionStatistics(session);
    expect(questionStats).toHaveLength(100);

    // 5. Apply Relative Grading (Çan Eğrisi)
    const { results: relativeGraded, report } = applyRelativeGrading(session.results);
    expect(relativeGraded).toHaveLength(5);
    expect(report.mean).toBeGreaterThan(0);
    const topStudent = relativeGraded.find((s) => s.id === 'STU-001');
    expect(topStudent?.score.letterGrade).toBe('AA');
    expect(topStudent?.score.relativeGrade).toBe('BB');
    expect(topStudent?.score.tScore).toBeGreaterThanOrEqual(60);

    // 6. Test manual student answer edit in review drawer
    const editedStudent = relativeGraded[1];
    const updatedAnswers = editedStudent.answers.map((a, idx) =>
      idx === 0 ? { ...a, marked: null, status: 'blank' as const } : a,
    );
    const recalculated = recalculateStudentAnswers(updatedAnswers, sections);
    expect(recalculated.score.blank).toBeGreaterThanOrEqual(1);

    // 7. Verify Excel/CSV exporter rows contain dynamic section headers and 3-way grades
    const exportData = summaryRows({ ...session, results: relativeGraded });
    expect(exportData.length).toBe(6); // 1 header + 5 rows
    const headerRow = exportData[0] as string[];
    expect(headerRow).toContain('100 Puan');
    expect(headerRow).toContain('4.00 GPA');
    expect(headerRow).toContain('Harf Notu');
    expect(headerRow).toContain('Çan Eğrisi Harfi (T-Skor)');
    expect(headerRow).toContain('Bölüm 1 Net');
  });
});

function createStudent(id: string, key: AnswerChoice[], wrongCount: number): StudentResult {
  const readAnswers = key.map((correctChoice, idx) => {
    if (idx < wrongCount) {
      const wrongIdx = (CHOICES.indexOf(correctChoice) + 1) % 5;
      return CHOICES[wrongIdx];
    }
    return correctChoice;
  });

  const { score, answers } = compareWithAnswerKey(
    key,
    {
      answers: readAnswers,
      states: readAnswers.map((a) => (a === null ? 'blank' : 'marked')),
      confidences: Array.from({ length: 100 }, () => 0.98),
      studentNumber: `2026${id.replace(/\D/g, '')}`,
      studentNumberConfidence: 0.99,
      diagnostics: { averageConfidence: 0.98, contourCount: 100, processingMs: 15 },
    },
    getDefaultSections(),
  );

  return {
    id,
    studentNumber: `2026${id.replace(/\D/g, '')}`,
    studentNumberSource: 'form',
    studentNumberNeedsReview: false,
    sourceName: `${id}.png`,
    processedAt: new Date().toISOString(),
    score,
    answers,
    diagnostics: { averageConfidence: 0.98, contourCount: 100, processingMs: 15 },
  };
}
