export const CHOICES = ['A', 'B', 'C', 'D', 'E'] as const;
export type AnswerChoice = (typeof CHOICES)[number];
export type ReadState = 'marked' | 'blank' | 'ambiguous';
export type AnswerStatus = 'correct' | 'wrong' | 'blank' | 'ambiguous';

export interface FormDiagnostics {
  averageConfidence: number;
  contourCount: number;
  processingMs: number;
}

export interface FormReadResult {
  answers: Array<AnswerChoice | null>;
  states: ReadState[];
  confidences: number[];
  studentNumber: string | null;
  studentNumberConfidence: number | null;
  diagnostics: FormDiagnostics;
}

export type LetterGrade = 'AA' | 'BA' | 'BB' | 'CB' | 'CC' | 'DC' | 'DD' | 'FD' | 'FF';

export interface ExamSection {
  id: string;
  name: string;
  startQuestion: number;
  endQuestion: number;
  weight?: number;
}

export interface SectionScore {
  sectionId: string;
  name: string;
  startQuestion: number;
  endQuestion: number;
  questionCount: number;
  correct: number;
  wrong: number;
  blank: number;
  ambiguous: number;
  net: number;
  score100: number;
  gpa4: number;
  letterGrade: LetterGrade;
}

export interface QuestionResult {
  question: number;
  key: AnswerChoice;
  marked: AnswerChoice | null;
  status: AnswerStatus;
  confidence: number;
  weight?: number;
}

export interface Score {
  correct: number;
  wrong: number;
  blank: number;
  ambiguous: number;
  net: number;
  percentage: number;
  score100: number;
  gpa4: number;
  letterGrade: LetterGrade;
  tScore?: number;
  relativeGrade?: LetterGrade;
  sections?: SectionScore[];
}

export interface StudentResult {
  id: string;
  studentNumber: string;
  studentNumberSource: 'form' | 'filename' | 'manual' | 'generated';
  studentNumberNeedsReview: boolean;
  sourceName: string;
  sourceFingerprint?: string;
  partIndex?: number;
  processedAt: string;
  score: Score;
  answers: QuestionResult[];
  diagnostics: FormDiagnostics;
}

export type DuplicateMode = 'skip' | 'reprocess';
export type PartitionMode = 'size' | 'count';

export interface ProcessingSettings {
  concurrency: 1 | 2 | 3 | 4;
  partitionMode: PartitionMode;
  partSize: number;
  partCount: number;
  duplicateMode: DuplicateMode;
  sorting: 'filename';
}

export type SessionProcessingStatus = 'processing' | 'interrupted' | 'completed';

export interface SessionProgress {
  status: SessionProcessingStatus;
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  currentPart: number;
  partCount: number;
  settings: ProcessingSettings;
  updatedAt: string;
}

export interface ExamSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  algorithmVersion: string;
  questionCount: 100;
  answerKey: AnswerChoice[];
  sections?: ExamSection[];
  questionWeights?: number[];
  results: StudentResult[];
  progress?: SessionProgress;
  useRelativeGrading?: boolean;
}

export interface QuestionStatistics {
  question: number;
  key: AnswerChoice;
  correct: number;
  wrong: number;
  blank: number;
  ambiguous: number;
  correctRate: number;
  wrongRate: number;
  blankRate: number;
  difficulty: number;
  optionCounts: Record<AnswerChoice, number>;
}

export type QueueStatus = 'waiting' | 'hashing' | 'processing' | 'completed' | 'skipped' | 'error';

export type QueueSourceKind = 'image' | 'pdf-page' | 'zip-image';

export interface QueueItem {
  id: string;
  sourceFile: File;
  sourceKind: QueueSourceKind;
  displayName: string;
  originalIndex: number;
  pdfPage?: number;
  archiveEntryName?: string;
  sourceFingerprint?: string;
  partIndex: number;
  status: QueueStatus;
  error?: string;
}

export interface ProcessingJob {
  id: string;
  sessionId: string;
  sourceName: string;
  sourceFingerprint?: string;
  partIndex: number;
  status: QueueStatus;
  studentNumber?: string;
  resultId?: string;
  error?: string;
  updatedAt: string;
}

export interface ProcessingProgress {
  total: number;
  completed: number;
  failed: number;
  active: string[];
}
